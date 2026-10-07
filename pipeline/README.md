# Pipeline

Builds the dataset for one election round from TSE's open data. It checks every number
against TSE's own totals and writes Parquet and JSON only when all of them match.

## Run it

```bash
uv sync
uv run eleicoes build --round 1 --out dist/round-1
```

A complete build downloads about 3.5 GB into `data/cache/` and takes about four minutes
on a laptop. For a fast local run, build a few states. A partial build skips the national
presidential check, and its manifest says `parcial: true`, so it can never be published:

```bash
uv run eleicoes build --round 1 --out dist/ac --states AC
```

`--cdn-base` and `--results-base` point the build at other copies of TSE's files, which the
tests use. Such a build's manifest says `fontes_tse: false`, so it can never be published
either.

If a check fails, the build writes nothing. It prints the first 50 mismatches and lists
every one in `data/work/reconciliation-report.txt`.

## Test it

```bash
uv run pytest
uv run ruff check src tests && uv run ruff format --check src tests
```

The tests build a miniature country from `tests/fixtures/data/`: a few real polling
stations from Acre, Pernambuco, Sergipe and abroad, chosen to cover each case the rules
must handle. Candidate identifiers in the fixtures are synthetic.

To recut the fixtures after a real build has filled `data/cache/`:

```bash
uv run python tests/fixtures/build_fixtures.py
uv run python tests/fixtures/export_web_fixtures.py
```

The second command refreshes `web/fixtures/`, the web app's sample data. CI fails when
that folder differs from what the pipeline produces.

## Publish it

Only the "Publish data" workflow writes to storage, and only from `main`:

1. In GitHub, open Actions, then "Publish data", then "Run workflow" on `main`, with
   target `data`.
2. The build job runs the tests and a complete build against TSE's files, with no
   secret. Its summary shows the duration, the peak disk use and the output size.
3. The upload job waits for Luiz's approval in the `data-publish` environment. Approve
   it within a day, because the build's files expire after that.
4. The upload writes `v/<YYYYMMDD>-<commit>-<run id>/` to R2, with `manifest.json`
   last. Its summary shows the version and the manifest's SHA-256, which the app pins.

A version is never overwritten. If an upload stops halfway, its version has no manifest,
and the app never pins it. If the upload job failed before it wrote anything, for
example because the approval came too late, re-run that job. Otherwise start a new run.
A re-run keeps the run's ID, so it tries the same version path and stops.

`.github/scripts/upload-version.sh` does the upload. Its tests in
`tests/test_upload_version.py` need the AWS CLI and the `upload-tests` dependency group,
which the publish build job leaves out:

```bash
uv run --group upload-tests pytest tests/test_upload_version.py
```

They skip on a machine without those tools, but never in CI.
