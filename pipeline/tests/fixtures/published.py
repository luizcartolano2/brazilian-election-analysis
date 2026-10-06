"""Publishes the fixture files under TSE's URL layout, as `file://` URLs, zipped as TSE ships them.

Zips get a fixed timestamp, so the same fixtures always give the same bytes and checksums."""

import shutil
import zipfile
from pathlib import Path

from eleicoes.sources import Bases, bulk_sources, round_config, state_votes_source

REAL = Bases()
CONFIG = round_config(1)
FIXTURE_STATES = ("AC", "PE", "SE")
FIXED_TIME = (2026, 10, 4, 0, 0, 0)


def csv_path(data: Path, source) -> Path:
    folder = source.url.removeprefix(REAL.cdn + "/").rsplit("/", 1)[0]
    return data / "cdn" / folder / source.member


def publish_fixtures(data: Path, root: Path) -> Bases:
    shutil.rmtree(root, ignore_errors=True)
    shutil.copytree(data / "results", root / "results")
    sources = list(bulk_sources(CONFIG, REAL).values())
    sources += [state_votes_source(CONFIG, REAL, state) for state in FIXTURE_STATES]
    for source in sources:
        csv_file = csv_path(data, source)
        if not csv_file.exists():
            continue
        target = root / "cdn" / source.url.removeprefix(REAL.cdn + "/")
        target.parent.mkdir(parents=True, exist_ok=True)
        member = zipfile.ZipInfo(source.member, date_time=FIXED_TIME)
        member.compress_type = zipfile.ZIP_DEFLATED
        with zipfile.ZipFile(target, "w") as archive:
            archive.writestr(member, csv_file.read_bytes())
    return Bases(cdn=f"file://{root}/cdn", results=f"file://{root}/results")
