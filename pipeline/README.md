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
