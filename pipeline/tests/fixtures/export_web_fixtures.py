"""Copies the pipeline's output for the fixtures to `web/fixtures/`, the app's sample data.

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
TARGET = HERE.parents[2] / "web" / "fixtures"
CLOCK = "2026-10-06T00:00:00Z"


def main() -> None:
    with tempfile.TemporaryDirectory() as scratch:
        root = Path(scratch)
        bases = publish_fixtures(HERE / "data", root / "tse")
        options = BuildOptions(
            round_number=1,
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
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=1) + "\n",
            encoding="utf-8",
        )
        shutil.rmtree(TARGET, ignore_errors=True)
        shutil.copytree(out, TARGET)
    print(f"web fixtures written to {TARGET}")


if __name__ == "__main__":
    main()
