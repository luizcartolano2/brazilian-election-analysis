"""Command line: `eleicoes build --round 1 --out dist/`."""

import argparse
import subprocess
import sys
from pathlib import Path

from eleicoes.aggregates import MalformedAggregate, UnknownDestination
from eleicoes.build import Build, BuildError, BuildOptions, log
from eleicoes.download import Downloader, SourceUnavailable
from eleicoes.load import CandidateFileError
from eleicoes.privacy import PersonalDataError
from eleicoes.reconcile import ReconciliationFailed
from eleicoes.sources import CDN_BASE, RESULTS_BASE, Bases


def current_commit() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="eleicoes")
    commands = root.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build", help="build the dataset for one round")
    build.add_argument("--round", type=int, required=True, dest="round_number")
    build.add_argument("--out", type=Path, required=True)
    build.add_argument("--work", type=Path, default=Path("data/work"))
    build.add_argument("--cache", type=Path, default=Path("data/cache"))
    build.add_argument(
        "--states",
        help="comma-separated state codes for a partial build, which can never be published",
    )
    build.add_argument("--fresh", action="store_true", help="download every source again")
    build.add_argument("--commit", default=None)
    build.add_argument("--cdn-base", default=CDN_BASE)
    build.add_argument("--results-base", default=RESULTS_BASE)
    return root


EXPECTED_FAILURES = (
    BuildError,
    CandidateFileError,
    MalformedAggregate,
    PersonalDataError,
    ReconciliationFailed,
    SourceUnavailable,
    UnknownDestination,
    ValueError,
)


def main(argv: list[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    states = (
        tuple(state.strip().upper() for state in arguments.states.split(",") if state.strip())
        if arguments.states
        else None
    )
    options = BuildOptions(
        round_number=arguments.round_number,
        out_dir=arguments.out,
        work_dir=arguments.work,
        commit=arguments.commit or current_commit(),
        states=states,
        bases=Bases(cdn=arguments.cdn_base, results=arguments.results_base),
    )
    downloader = Downloader(arguments.cache, reuse_cache=not arguments.fresh)
    try:
        Build(options, downloader).run()
    except EXPECTED_FAILURES as error:
        log(f"build failed: {error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
