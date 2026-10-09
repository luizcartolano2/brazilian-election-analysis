import csv
import io
import json
import shutil
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import duckdb
import pytest
from fixtures.published import csv_path, publish_fixtures

from eleicoes.build import Build, BuildOptions
from eleicoes.download import Downloader
from eleicoes.load import quoted
from eleicoes.sources import Bases

FIXTURES = Path(__file__).parent / "fixtures" / "data"
CLOCK = "2026-10-06T00:00:00Z"


def query(path: Path, sql: str):
    """Runs `sql` with `FILE` standing for the Parquet file at `path`."""
    return duckdb.connect().execute(sql.replace("FILE", f"read_parquet({quoted(path)})")).fetchall()


@dataclass
class Tse:
    """A mutable copy of the fixtures, published under TSE's URL layout as `file://` URLs."""

    data: Path
    root: Path

    def csv_path(self, source) -> Path:
        return csv_path(self.data, source)

    def aggregate_path(self, relative: str) -> Path:
        return self.data / "results" / "ele2026" / relative

    def edit_json(self, path: Path, change: Callable[[dict], None]) -> None:
        document = json.loads(path.read_text(encoding="utf-8"))
        change(document)
        path.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")

    def edit_csv(self, path: Path, change: Callable[[dict], bool]) -> int:
        """Applies `change` to each row as a dict; returns how many rows it changed."""
        with path.open(encoding="latin-1", newline="") as handle:
            rows = list(csv.reader(handle, delimiter=";", quotechar='"'))
        header, body = rows[0], rows[1:]
        changed = 0
        for row in body:
            record = dict(zip(header, row, strict=True))
            if change(record):
                row[:] = [record[name] for name in header]
                changed += 1
        buffer = io.StringIO()
        writer = csv.writer(buffer, delimiter=";", quoting=csv.QUOTE_ALL, lineterminator="\n")
        writer.writerows([header, *body])
        path.write_bytes(buffer.getvalue().encode("latin-1"))
        return changed

    def publish(self) -> Bases:
        return publish_fixtures(self.data, self.root)


@pytest.fixture
def tse(tmp_path) -> Tse:
    data = tmp_path / "fixtures"
    shutil.copytree(FIXTURES, data)
    return Tse(data=data, root=tmp_path / "tse")


def run_build(
    tse: Tse, tmp_path: Path, name: str = "out", states=None, round_number: int = 1
) -> Path:
    options = BuildOptions(
        round_number=round_number,
        out_dir=tmp_path / name,
        work_dir=tmp_path / f"work-{name}",
        commit="test",
        states=states,
        bases=tse.publish(),
    )
    downloader = Downloader(tmp_path / f"cache-{name}", clock=lambda: CLOCK, retry_delay=0)
    return Build(options, downloader).run()


@pytest.fixture(scope="session")
def built(tmp_path_factory) -> Path:
    """One complete build of the unmodified fixtures, shared by read-only tests."""
    tmp_path = tmp_path_factory.mktemp("built")
    data = tmp_path / "fixtures"
    shutil.copytree(FIXTURES, data)
    return run_build(Tse(data=data, root=tmp_path / "tse"), tmp_path)


@pytest.fixture(scope="session")
def built_runoff(tmp_path_factory) -> Path:
    """One complete round-2 build of the unmodified fixtures, shared by read-only tests."""
    tmp_path = tmp_path_factory.mktemp("built-runoff")
    data = tmp_path / "fixtures"
    shutil.copytree(FIXTURES, data)
    return run_build(Tse(data=data, root=tmp_path / "tse"), tmp_path, round_number=2)
