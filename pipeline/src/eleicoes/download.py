"""Downloads sources into a cache and records what was read."""

import hashlib
import http.client
import json
import shutil
import time
import urllib.error
import urllib.request
import zipfile
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

from eleicoes.sources import Source

CHUNK = 1 << 20
ATTEMPTS = 3


class SourceUnavailable(Exception):
    def __init__(self, source: Source, reason: str):
        super().__init__(f"source {source.key} ({source.url}) is unavailable: {reason}")
        self.source = source


@dataclass(frozen=True)
class Downloaded:
    key: str
    url: str
    path: Path
    size: int
    sha512: str
    downloaded_at: str

    def record(self) -> dict:
        record = asdict(self)
        record.pop("path")
        return record


def sha512_of(path: Path) -> str:
    digest = hashlib.sha512()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def utc_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class Downloader:
    def __init__(
        self,
        cache_dir: Path,
        reuse_cache: bool = True,
        clock: Callable[[], str] = utc_now,
        retry_delay: float = 2.0,
    ):
        self.cache_dir = cache_dir
        self.reuse_cache = reuse_cache
        self.clock = clock
        self.retry_delay = retry_delay
        self.fetched: dict[str, Downloaded] = {}

    def fetch(self, source: Source) -> Downloaded:
        if source.key in self.fetched:
            return self.fetched[source.key]
        name = (
            hashlib.sha256(source.url.encode()).hexdigest()[:16]
            + "-"
            + source.url.rsplit("/", 1)[-1]
        )
        path = self.cache_dir / name
        meta_path = path.with_name(path.name + ".json")
        downloaded = self._cached(source, path, meta_path) if self.reuse_cache else None
        if downloaded is None:
            downloaded = self._download(source, path)
            meta_path.write_text(json.dumps(downloaded.record(), sort_keys=True))
        self.fetched[source.key] = downloaded
        return downloaded

    @staticmethod
    def _cached(source: Source, path: Path, meta_path: Path) -> "Downloaded | None":
        """Reuses a cached file only if it was downloaded for this source and its bytes still
        hash to what was downloaded, so the manifest records the bytes the build read."""
        if not (path.exists() and meta_path.exists()):
            return None
        meta = json.loads(meta_path.read_text())
        if meta.get("url") != source.url or meta.get("key") != source.key:
            return None
        if path.stat().st_size != meta.get("size") or sha512_of(path) != meta.get("sha512"):
            return None
        return Downloaded(path=path, **meta)

    def _download(self, source: Source, path: Path) -> Downloaded:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(path.name + ".part")
        last_error = "no attempt made"
        for attempt in range(ATTEMPTS):
            try:
                digest, size = self._stream(source, partial)
                partial.replace(path)
                return Downloaded(source.key, source.url, path, size, digest, self.clock())
            except urllib.error.HTTPError as error:
                partial.unlink(missing_ok=True)
                if error.code < 500:
                    raise SourceUnavailable(source, f"HTTP {error.code}") from error
                last_error = f"HTTP {error.code}"
            except http.client.IncompleteRead as error:
                partial.unlink(missing_ok=True)
                last_error = f"truncated: {error}"
            except (OSError, ValueError, http.client.HTTPException) as error:
                partial.unlink(missing_ok=True)
                last_error = f"{type(error).__name__}: {error}"
            if attempt + 1 < ATTEMPTS:
                time.sleep(self.retry_delay * (attempt + 1))
        raise SourceUnavailable(source, last_error)

    @staticmethod
    def _stream(source: Source, target: Path) -> tuple[str, int]:
        digest = hashlib.sha512()
        size = 0
        with urllib.request.urlopen(source.url, timeout=120) as response, target.open("wb") as out:
            expected = response.headers.get("Content-Length")
            while chunk := response.read(CHUNK):
                digest.update(chunk)
                out.write(chunk)
                size += len(chunk)
        if expected is not None and int(expected) != size:
            raise ValueError(f"truncated: received {size} bytes, expected {expected}")
        if size == 0:
            raise ValueError("received an empty file")
        return digest.hexdigest(), size

    def json(self, source: Source) -> dict:
        downloaded = self.fetch(source)
        try:
            return json.loads(downloaded.path.read_text(encoding="utf-8"))
        except ValueError as error:
            raise SourceUnavailable(source, f"not valid JSON: {error}") from error

    def extract(self, source: Source, into: Path) -> Path:
        """Extracts the source's CSV member, so only one large CSV sits on disk at a time."""
        downloaded = self.fetch(source)
        into.mkdir(parents=True, exist_ok=True)
        target = into / source.member
        try:
            with (
                zipfile.ZipFile(downloaded.path) as archive,
                archive.open(source.member) as member,
                target.open("wb") as out,
            ):
                shutil.copyfileobj(member, out, CHUNK)
        except (zipfile.BadZipFile, KeyError) as error:
            target.unlink(missing_ok=True)
            raise SourceUnavailable(source, f"cannot read {source.member}: {error}") from error
        return target

    def records(self) -> list[dict]:
        return [self.fetched[key].record() for key in sorted(self.fetched)]
