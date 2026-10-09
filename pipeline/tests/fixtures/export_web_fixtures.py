"""Copies the pipeline's output for the fixtures to `web/fixtures/` for round 1 and
`web/fixtures-t2/` for round 2, the app's sample data.

Sources are recorded as `fixture://` paths: the build read them from a temporary folder, and
their checksums describe the fixture files, never TSE's real ones."""

import json
import shutil
import tempfile
from pathlib import Path

from published import publish_fixtures

from eleicoes.build import Build, BuildOptions
from eleicoes.download import Downloader

HERE = Path(__file__).parent
WEB = HERE.parents[2] / "web"
TARGETS = {1: WEB / "fixtures", 2: WEB / "fixtures-t2"}
# build_runoff_fixtures.py makes round 2 up, so the app marks its pages as synthetic.
SYNTHETIC_ROUNDS = {2}
CLOCK = "2026-10-06T00:00:00Z"


def main() -> None:
    for round_number, target in TARGETS.items():
        export(round_number, target)


def export(round_number: int, target: Path) -> None:
    with tempfile.TemporaryDirectory() as scratch:
        root = Path(scratch)
        bases = publish_fixtures(HERE / "data", root / "tse")
        options = BuildOptions(
            round_number=round_number,
            out_dir=root / "out",
            work_dir=root / "work",
            commit="fixtures",
            bases=bases,
        )
        downloader = Downloader(root / "cache", clock=lambda: CLOCK, retry_delay=0)
        out = Build(options, downloader).run()

        manifest_path = out / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for source in manifest["fontes"]:
            source["url"] = (
                source["url"]
                .replace(bases.cdn, "fixture://cdn")
                .replace(bases.results, "fixture://results")
            )
        if round_number in SYNTHETIC_ROUNDS:
            manifest["sintetico"] = True
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=1) + "\n",
            encoding="utf-8",
        )
        shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(out, target)
    print(f"web fixtures written to {target}")


if __name__ == "__main__":
    main()
