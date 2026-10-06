## Context

See `proposal.md` for why. The repository holds no code yet, so this design creates
`pipeline/`, `worker/` and `web/` from nothing, within decisions D4 and D7 to D13.

Facts checked against real 2026 data on 2026-10-06 that shape the approach:

- Station-level votes for the first round are about 92 million rows: 3.8 million for
  President, the rest mostly the deputy races. Narrow, sorted Parquet takes about 1.2
  bytes per row, so roughly 110 MB in total.
- TSE ships the state races as one zip per state, 2.6 GB zipped in all. Unzipped, Acre
  grows about 9.5 times, so all states would be roughly 25 GB on disk at once.
- Turnout per station (`detalhe_votacao_secao_2026`) is one zip with a file per state and
  a `_BRASIL` file that holds every race, including President.
- For every station and race checked, the votes equal attendance times the choices per
  voter. That ratio is 1 for most races and 2 for the Senate, which elects two seats.
  The national presidential sums match TSE's aggregate exactly for all 12 candidates and
  for blank votes.
- Number 28 for President has 5,246 votes in the station data. TSE's aggregate does not
  list it as a candidate and counts those votes as technical nulls (`vnt`).
- TSE's aggregate files exist per race and state, including the Federal District's
  district deputy race and votes cast abroad (`zz`). Each one states the choices per
  voter (`nv`).
- `consulta_cand_2026` publishes CPF and voter-ID numbers unmasked.
- DuckDB 1.5.6 reads TSE's Latin-1 CSV files directly.
- TSE's results app opens a station by URL:
  `https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/dados-de-urna/boletim-de-urna?e=6257&uf=ac&mu=01066&zn=0004&se=0077`.

## Goals / Non-Goals

**Goals:**

- One pipeline run on a clean GitHub runner builds and publishes the whole first round.
- A visitor on a phone sees a state's headline results without downloading Parquet.
- Drilling down to a station reads only the bytes for that state and race.

**Non-Goals:**

- No chart library. Results are ranked bars drawn with HTML and CSS, with the numbers as
  text. The estimates change chooses a chart library.
- No pre-rendered pages below the state level in this change. See Open Questions.
- No verification of TSE's JWS signatures yet. See Open Questions.

## Decisions

### D-A. Published layout

Everything lives under one version path, `v/<YYYYMMDD>-<short commit>/`:

```
manifest.json
2026/municipios.parquet
2026/t1/candidatos.parquet
2026/t1/votos/cargo=<c>/uf=<UF>.parquet        one file per race and state; President adds uf=ZZ
2026/t1/comparecimento/uf=<UF>.parquet          turnout, every race in the state
2026/t1/secoes/uf=<UF>.parquet                  stations and polling places
2026/t1/totais/municipio/cargo=<c>/uf=<UF>.parquet
2026/t1/totais/zona/cargo=<c>/uf=<UF>.parquet
2026/t1/resumo/br.json
2026/t1/resumo/<uf>.json                        one per state, plus zz
```

The schemas below are new, because no schema exists before this change.

`votos` is sorted by `municipio, zona, secao, tipo, numero`:

| Column | Type | Meaning |
|---|---|---|
| `municipio` | int32 | TSE municipality code |
| `zona` | int16 | Electoral zone |
| `secao` | int16 | Polling station number |
| `tipo` | int8 | 1 candidate, 2 party list, 3 blank, 4 null, 5 technical null |
| `numero` | int32 | Number typed. 0 for blank and null |
| `votos` | int32 | Votes |

`comparecimento`: `municipio`, `zona`, `secao`, `cargo`, `aptos`, `comparecimento`,
`abstencoes`, `nominais`, `legenda`, `brancos`, `nulos`, `nulos_tecnicos`.

`secoes`: `municipio`, `zona`, `secao`, `local_votacao`, `agregada` (bool),
`secao_principal`, `nome_local`, `endereco`, `bairro`, `latitude`, `longitude`,
`eleitores`.

`candidatos`: `cargo`, `uf`, `numero`, `nome_urna`, `partido_numero`, `partido_sigla`,
`federacao`, `coligacao`, `situacao`, `resultado`, `conta_como_valido` (bool).

`municipios`: `municipio` (TSE code), `ibge` (from the results config `cdi` field),
`nome`, `uf`, `capital` (bool).

`resumo/*.json` holds the totals of each race for one area, the shape that the static
pages render.

Why partition by race and state: a governor page in one state reads one file, and
DuckDB-WASM fetches only the row groups whose `municipio` range matches. Alternative
rejected: one file per state with every race. It is simpler to write, but every deputy
query would read past the other races.

### D-B. Pipeline: DuckDB to transform, pyarrow to write

The pipeline is a uv project in `pipeline/` with one command:
`uv run eleicoes build --round 1 --out dist/`, plus `--states AC,RR` for fast local runs.
Stages run in order: download, normalize, classify, reconcile, write, summarize,
manifest.

- **Download**: each source goes to a cache keyed by URL, with its SHA-512 recorded
  before anything reads it.
- **One state at a time**: unzip one state, process it, delete the extracted file. This
  keeps peak disk near the largest state, not 25 GB.
- **Normalize**: DuckDB `read_csv(..., encoding='latin-1')` reads only the allowlisted
  columns. The candidate allowlist is a constant, and a test fails if any output has a
  column on the deny list (`CPF`, `TITULO`, `EMAIL`, `NASCIMENTO`).
- **Classify**: 95 is blank, 96 is null, a two-digit number in a proportional race is a
  party list. A number that TSE's aggregate for that race and state does not list as a
  counted candidate is a technical null. Everything else is a candidate.
- **Write**: DuckDB returns Arrow tables, and pyarrow writes them single-threaded with
  zstd level 9, a fixed row-group size and no timestamps in file metadata. Byte-identical
  reruns follow from the fixed sort order and these settings. Alternative rejected:
  DuckDB's own `COPY ... TO parquet`, whose multi-threaded writer does not promise a
  stable row-group layout.

Alternative rejected for the whole stage: pandas, as in the prototype. It loads a 1 GB CSV
into memory, and it is a different engine from the browser's.

### D-C. Reconciliation is a stage, not a test

Reconciliation runs inside every build, because it checks TSE's data, not our code:

1. Per station and race, the sum of `votos` equals `comparecimento` times `nv`, where `nv`
   comes from TSE's aggregate for that race.
2. Per state and race, and for Brazil in the presidential race, each candidate's sum
   equals the aggregate's `vap`. Blank, null and technical-null sums equal `vb`, `vn` and
   `vnt`.

The aggregates come from
`resultados.tse.jus.br/oficial/ele2026/<eleicao>/dados/<uf>/<uf>-c<cargo:4>-e<eleicao:6>-u.json`.
A failure prints every mismatch, not only the first, and exits non-zero.

### D-D. Publishing through a protected GitHub environment

`.github/workflows/publish-data.yml` runs on `workflow_dispatch` only. Its job uses a
GitHub environment, `data-publish`, whose deployment-branch rule allows `main` only, and
the R2 credentials are secrets of that environment. A run from another branch cannot
read them, and pull-request jobs never reference that environment.

The job builds, then lists `v/<id>/` with the S3 API against R2's endpoint and fails if
anything is there. It uploads data files with `aws s3 cp`, which GitHub's Ubuntu image
already has, and uploads `manifest.json` last.

Alternative rejected: `wrangler r2 object put`, which uploads one object per call and has
no listing for the existence check.

### D-E. Worker

The Worker is a TypeScript module with one R2 binding. It serves a key only when it
starts with `v/`, has a version segment and names a file. `HEAD` uses `bucket.head()`,
and `GET` with `Range` uses `bucket.get(key, { range })`. The allowed origins are a list
in `wrangler.toml`: the production origin, a pattern for the Vercel project's preview
origins, and `http://localhost:3000`. Tests run in Miniflare through
`@cloudflare/vitest-pool-workers`, against a local R2 bucket.

The Worker deploys from `.github/workflows/deploy-worker.yml` on pushes to `main` that
touch `worker/`, through a `worker-deploy` environment that holds the Cloudflare API
token.

### D-F. Web: static export, two route trees, no i18n library

`web/` is Next.js 16 with `output: 'export'` and `trailingSlash: true`:

- Portuguese pages live under the route group `app/(pt)/` and English pages under
  `app/en/`. Both render the same components with a `locale` prop, which keeps Portuguese
  at the root with no prefix in a static export. Alternative rejected: `next-intl`. It
  supports static export, but serving the default language without a prefix relies on
  its middleware, and a static export cannot run middleware.
- Messages are `web/messages/pt.json` and `web/messages/en.json`, read through a small
  typed `t()`. A Vitest test compares their key sets. Numbers use `Intl.NumberFormat`
  with `pt-BR` or `en-US`.
- Pre-rendered pages are `/2026/` and `/2026/<uf>/` for each state and `zz`, in both
  languages, 58 pages in all. At build time they read `resumo/*.json` from the pinned
  version, so the HTML carries the headline numbers.
- Municipality, zone and station views are one static page each, which reads its
  location from query parameters (`?uf=ac&mu=01066&zn=4&se=77`) and queries DuckDB-WASM
  in the browser.
- DuckDB-WASM's worker and wasm files are copied into `public/duckdb/` at build, so the
  CSP can stay at `script-src 'self' 'wasm-unsafe-eval'` with no CDN. They load only on
  the views that query.
- `web/src/data-version.ts` holds the pinned version and the Worker's base URL, and is
  the only place either appears.
- Security headers, including the CSP, live in `web/vercel.json`.

### D-G. CI

`ci.yml` gains three jobs next to `openspec`:

- **pipeline**: uv, ruff and pytest. Fixtures are small CSVs cut from real files, plus
  synthetic cases for the technical null, aggregated stations and the Senate's two
  choices.
- **worker**: typecheck and Vitest.
- **web**: typecheck, lint, Vitest, a build against `web/fixtures/` instead of the Worker,
  and one Playwright smoke test that loads the Brazil page with JavaScript disabled.

## Risks / Trade-offs

- [Runner disk space for unzipped CSVs] → One state at a time (D-B). The first publish
  run logs peak disk use.
- [TSE republishes a file with corrections] → The build picks up the new file, its
  SHA-512 differs in the manifest, and publishing makes a new version. Nothing silently
  changes under a pinned version.
- [DuckDB-WASM adds several MB of JavaScript and wasm] → Only drill-down views load it.
  Brazil and state pages are plain HTML.
- [Deputy files are large in São Paulo] → Sorted rows and row-group statistics let a
  station query read a few hundred KB. The first measurement goes into the PR that adds
  the web views.
- [The Worker's free plan allows 100,000 requests a day] → One station view makes a
  handful of range requests, so the limit is far above what an unpromoted site needs.
  The Cloudflare dashboard shows the count.
- [TSE changes its station deep-link format] → One function builds the link, and a test
  pins the format. A break only affects an outbound link.
- [Technical-null classification depends on TSE's aggregate list] → Reconciliation
  compares the technical-null total with `vnt`, so a wrong classification fails the build.

## Migration Plan

This is a new system. The first deployment goes in this order:

1. Luiz creates the R2 bucket, the API tokens, and the two GitHub environments.
2. Merge the Worker, and it deploys.
3. Run the publish workflow and note the version.
4. Pin that version in `web/`, then create the Vercel project on `web/` and add the CNAME
   at GoDaddy.

Rollback for data is a PR that pins the previous version. Rollback for the Worker is
redeploying the previous commit.

## Open Questions

- Should municipality pages also be pre-rendered, for search? That is about 11,000 more
  HTML files. It changes neither the specs nor the data layout, so it can wait until the
  station views work.
- Can the pipeline verify TSE's EdDSA signatures on the results files? It needs TSE's
  public key, which has not been found yet.
