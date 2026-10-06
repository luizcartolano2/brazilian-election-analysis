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
- Three elections share the first round: President (`6257`), the state races (`6259`)
  and Fernando de Noronha's Conselheiro Distrital (`6261`, race code 25, 10 stations,
  no second round). The council's votes are in the Pernambuco station file. Its aggregate
  is per municipality: `ele2026/6261/dados/pe/pe30015-c0025-e006261-u.json`.
- In TSE's aggregates, `nv` is the number of seats: 7 for the council and 8 for Acre's
  federal deputies. The choices per voter are total votes (`v.tv`) divided by
  attendance (`e.c`). That ratio is 2 for the Senate and 1 for every other race checked.
- For every station and race checked, the votes equal attendance times the choices per
  voter. The national presidential sums match TSE's aggregate exactly for all 12
  candidates and for blank votes.
- The aggregate classifies votes in a `dvt` field. Candidate values seen are
  `Válido` and `Anulado sub judice`, and party lists carry `Válido (legenda)`. Acre's
  federal deputy race has 6,127 votes annulled sub judice (`vansj`). Number 28 for
  President has 5,246 votes in the station data, is absent from the aggregate, and those
  votes are counted as technical nulls (`vnt`). The turnout file counts them as nominal
  votes.
- `votacao_candidato_munzona_2026` (316 MB) holds candidate totals per municipality and
  zone. For Acre's governor race they match the station sums exactly. Its party-list and
  turnout counterparts did not exist on 2026-10-06 (HTTP 404).
- `consulta_cand_2026` publishes CPF and voter-ID numbers unmasked.
- DuckDB 1.5.6 reads TSE's Latin-1 CSV files directly. Its Parquet writer produced
  byte-identical files on reruns at 1 and 8 threads.
- TSE's results app opens a station by URL:
  `https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/dados-de-urna/boletim-de-urna?e=6257&uf=ac&mu=01066&zn=0004&se=0077`.

## Goals / Non-Goals

**Goals:**

- One publish run on clean GitHub runners builds and publishes the whole first round.
- A visitor on a phone sees a state's headline results without downloading Parquet.
- Drilling down to a station reads only the bytes for that state and race.
- Storage write credentials are never available to the pipeline, its dependencies, or
  anything installed during a build. Only the runner's preinstalled AWS CLI and a short
  upload script from this repository receive them.

**Non-Goals:**

- No chart library. Results are ranked bars drawn with HTML and CSS, with the numbers as
  text. The estimates change chooses a chart library.
- No pre-rendered pages below the state level in this change. See Open Questions.
- No verification of TSE's JWS signatures yet. See Open Questions.

## Decisions

### D-A. Published layout

Data lives under one version path, `v/<YYYYMMDD>-<short commit>-<run id>/`:

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

The council race is `cargo=25/uf=PE`. The query engine's WebAssembly file lives outside
versions, at `assets/duckdb-wasm/<package version>/`.

The schemas below are new, because no schema exists before this change.

`votos` is sorted by `municipio, zona, secao, tipo, numero`:

| Column | Type | Meaning |
|---|---|---|
| `municipio` | int32 | TSE municipality code |
| `zona` | int16 | Electoral zone |
| `secao` | int16 | Polling station number |
| `tipo` | int8 | 1 candidate, 2 party list, 3 blank, 4 null, 5 technical null, 6 annulled, 7 annulled sub judice |
| `numero` | int32 | Number typed. 0 for blank and null |
| `votos` | int32 | Votes |

`comparecimento`: `municipio`, `zona`, `secao`, `cargo`, `aptos`, `comparecimento`,
`abstencoes`, `nominais`, `legenda`, `brancos`, `nulos`.

`secoes`: `municipio`, `zona`, `secao`, `local_votacao`, `agregada` (bool),
`secao_principal`, `nome_local`, `endereco`, `bairro`, `latitude`, `longitude`,
`eleitores`.

`candidatos`: the allowlisted registry fields `eleicao`, `turno`, `cargo`, `uf`,
`numero`, `nome_urna`, `partido_numero`, `partido_sigla`, `federacao`, `coligacao` and
`situacao`, plus `destino` and `resultado`, both from the aggregate. The allowlist test
checks exactly this column list.

`municipios`: `municipio` (TSE code), `ibge` (from the results config `cdi` field),
`nome`, `uf`, `capital` (bool).

`resumo/*.json` holds the totals of each race for one area, the shape that the static
pages render. `totais/*` holds the same totals per municipality and per zone.

Why partition by race and state: a governor page in one state reads one file, and
DuckDB-WASM fetches only the row groups whose `municipio` range matches. Alternative
rejected: one file per state with every race. It is simpler to write, but every deputy
query would read past the other races.

### D-B. Pipeline: DuckDB end to end

The pipeline is a uv project in `pipeline/` with one command:
`uv run eleicoes build --round 1 --out dist/`, plus `--states AC,RR,PE` for fast local
runs. Stages run in order: download, normalize, classify, reconcile, write, summarize,
manifest.

- **Download**: each source goes to `pipeline/data/cache/`, keyed by URL, with its
  SHA-512 recorded before anything reads it. The publish build starts with an empty cache
  and never uses `actions/cache`, so a file that TSE republishes under the same URL is
  always fetched again.
- **One state at a time**: unzip one state into `pipeline/data/`, process it, delete the
  extracted file. This keeps peak disk near the largest state, not 25 GB.
- **Normalize**: DuckDB `read_csv(..., encoding='latin-1')` reads only the allowlisted
  columns. The candidate allowlist is a constant, and a guard fails the run if any output
  has a column on the deny list (`CPF`, `TITULO`, `EMAIL`, `NASCIMENTO`). An error from the
  candidate stage is re-raised with the file, line and column only, because DuckDB's own
  message quotes the raw row, and Actions logs are public.
- **Classify**: 95 is blank and 96 is null. Every other number takes the destination that
  TSE's aggregate gives it for that race and area: `Válido` is a candidate,
  `Válido (legenda)` is a party list, `Anulado` is annulled and `Anulado sub judice` is
  annulled sub judice. A number missing from the aggregate is a technical null. Any other
  `dvt` value fails the run. The candidate's outcome comes from the aggregate's `st`.
- **Write**: DuckDB writes each file with `COPY (... ORDER BY ...) TO ... (FORMAT parquet,
  COMPRESSION zstd, COMPRESSION_LEVEL 9, ROW_GROUP_SIZE ...)`. A test builds the fixtures
  twice and compares every data file's checksum. Alternative rejected: pyarrow as the
  writer. It is one more dependency outside D12, and DuckDB's writer proved deterministic.
- **Fixtures**: small CSVs cut from real files, except that every personal identifier
  column holds a synthetic value with invalid check digits. A test scans every fixture
  and output for an 11-digit number with valid CPF check digits.
- Outputs go to `pipeline/dist/`, which `.gitignore` covers.

Alternative rejected for the whole stage: pandas, as in the prototype. It loads a 1 GB CSV
into memory, and it is a different engine from the browser's.

### D-C. Reconciliation is a stage, not a test

Reconciliation runs inside every build, because it checks TSE's data, not our code:

1. **Per station and race**: the sum of `votos` equals `comparecimento` times the choices
   per voter, which is the aggregate's `v.tv / e.c` for that race and area. A ratio that
   is not a whole number fails the run. The turnout file's counts must also match:
   `nominais` equals candidate, technical-null, annulled and annulled sub judice votes
   together, `legenda` equals party-list votes, and `brancos` and `nulos` equal blank and
   null votes. This mapping holds for President nationally. The first full build confirms
   it for the other races.
2. **Per municipality and zone**: each candidate's sum equals
   `votacao_candidato_munzona_2026`.
3. **Per aggregate area** (Brazil and each state, and Fernando de Noronha for the
   council): each candidate's sum equals the aggregate's `vap`, and each party's list
   votes equal that party's `tval`. The valid, party-list, blank, null, technical-null,
   annulled and annulled sub judice sums equal `vv`, `vl`, `vb`, `vn`, `vnt`, `van` and
   `vansj`. `tval` and `tvtl` held the same value in the one party checked so far. The
   first full build confirms that `tval` is the right field for every race.

The aggregates come from
`resultados.tse.jus.br/oficial/ele2026/<eleicao>/dados/<uf>/<area>-c<cargo:4>-e<eleicao:6>-u.json`,
where the area is the state code or, for a municipal election, the state code followed
by the municipality code. A failure prints every mismatch, not only the first, and exits
non-zero.

Party-list and turnout totals per municipality and zone have no independent TSE file
yet. They are sums of station figures that passed check 1, grouped by the same code that
check 2 tests.

### D-D. Publishing: a build job without secrets, an upload job behind approval

`.github/workflows/publish-data.yml` runs on `workflow_dispatch` only, with input
`target: data | duckdb-wasm`. It has a `concurrency` group without cancellation, so two
publishes never overlap. Every action is pinned to a commit SHA, and Dependabot keeps
those pins current.

1. **build** runs with `permissions: contents: read` and no environment. It runs
   `uv sync --locked`, the tests and the full build, then hands `dist/` to the next job as
   a workflow artifact with one day of retention. For the WebAssembly target, it runs
   `npm ci` in `web/` and copies the `.wasm` file out of the locked package.
2. **upload** uses the `data-publish` environment. That environment allows `main` only,
   requires Luiz as reviewer, and holds the R2 credentials. The job installs nothing and
   runs no pipeline code. It runs only the runner's preinstalled AWS CLI and
   `.github/scripts/upload-version.sh`, a short script from this repository. The script
   downloads the artifact's files, checks each file's SHA-256 against the manifest, lists
   `v/<id>/` with the S3 API against R2's endpoint and fails if anything is there,
   uploads the data files with `aws s3 cp`, and uploads `manifest.json` last. The
   pipeline CI job tests the script against a local S3 server.

If the account's R2 plan offers bucket locks, a lock rule on `v/` and `assets/` makes
immutability hold even against a stolen token.

Alternatives rejected: one job that builds and uploads, because then every PyPI package
runs beside the token. `wrangler r2 object put`, because it uploads one object per call
and cannot list for the existence check.

### D-E. Worker

The Worker is a TypeScript module with one R2 binding:

- It accepts a key only when it matches `v/<version id>/...` or
  `assets/duckdb-wasm/<version>/...`, every segment uses `[A-Za-z0-9_.=-]`, no segment
  is `..`, and the raw path holds no encoded slash. It checks this before touching
  storage.
- `HEAD` uses `bucket.head()`. `GET` uses `bucket.get(key, { range })` for `bytes=a-b`,
  `bytes=a-` and `bytes=-n`. A start beyond the end gets 416. A malformed header or
  several ranges are ignored, and the whole file is returned with 200, as the HTTP range
  standard allows.
- CORS allows the exact production origin, `http://localhost:3000`, and preview origins
  matching `^https://eleicoes-[a-z0-9-]+-<team slug>\.vercel\.app$`, where the team slug
  is set once the Vercel project exists. Every response carries `Vary: Origin`. The
  preflight allows `GET`, `HEAD` and the `Range` header. Responses expose
  `Content-Range`, `Content-Length`, `Accept-Ranges` and `ETag`.

Tests run in Miniflare through `@cloudflare/vitest-pool-workers`, against a local R2
bucket, with traversal and look-alike-origin payloads.

The Worker deploys from `.github/workflows/deploy-worker.yml` on pushes to `main` that
touch `worker/`. It runs through the `worker-deploy` environment, which requires Luiz as
reviewer and holds a custom Cloudflare token limited to Workers Scripts edit. A template
token might also grant R2 access, which would open a second way to write data. Wrangler
is third-party code and receives that token. The lockfile in `worker/`, the narrow token
scope and the approval gate are what protect it.

### D-F. Web: static export, two route trees, strict addresses

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
  languages, 58 pages in all.
- `web/src/data-version.ts` holds the pinned version name, its manifest's SHA-256 and the
  Worker's base URL. The Worker's origin also appears in the `connect-src` directive of
  `vercel.json`, because Vercel reads that file before any build step runs, so a build
  cannot generate it. A Vitest test fails when the two origins differ. The build-time
  loader fetches the
  manifest, checks its SHA-256, then checks each `resumo/*.json` it reads against the
  manifest, and fails the build on any difference.
- Municipality, zone and station views are one static page each. Each reads its location
  from query parameters such as `?uf=ac&mu=1066&zn=4&se=77`. A parser accepts `uf` only
  from the 27 states and `zz`, the race only from the election's races, and `mu`, `zn`
  and `se` only as whole numbers in range. Anything else shows the error state. Parquet
  URLs are built only from parsed values and the pinned version, and every value reaches
  DuckDB through a prepared statement, including the search text.
- DuckDB-WASM's worker script is self-hosted in `public/duckdb/`, because a browser
  `Worker` must load from the page's own origin. The `.wasm` file comes from the Worker at
  `assets/duckdb-wasm/<version>/`. That keeps the largest download off Vercel's monthly
  bandwidth, where Hobby has no overage and pauses the project instead.
- `web/fixtures/` is generated by the pipeline from its own fixtures, and the pipeline CI
  job fails when regenerating them changes anything. So a schema change that reaches only
  one side fails CI.
- Security headers live in `web/vercel.json` and apply to every path, `/duckdb/*`
  included. The policy is:

  ```
  default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
  worker-src 'self' blob:; connect-src 'self' <worker origin>; img-src 'self' data:;
  style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none';
  base-uri 'none'; form-action 'self'; frame-ancestors 'none'
  ```

  `'unsafe-inline'` for scripts is accepted: every App Router page carries inline
  scripts, and a static export cannot issue nonces. Alternative rejected: hashing each
  route's inline scripts in a postbuild step, which is fragile and would rewrite the
  headers on every build. Mitigations: React escapes TSE's strings, a lint rule forbids
  `dangerouslySetInnerHTML`, and `connect-src` limits where an injected script could
  send data.

### D-G. CI

`ci.yml` gains three jobs next to `openspec`, with every action pinned to a commit SHA:

- **pipeline**: `uv sync --locked`, ruff and pytest. This covers the CPF scan, the
  determinism test and the check that regenerated web fixtures match the committed ones.
- **worker**: typecheck and Vitest.
- **web**: typecheck, lint, Vitest, a build against `web/fixtures/`, and two Playwright
  tests. The first loads a state page with JavaScript disabled. The second serves the
  build with the headers from `vercel.json`, opens a station view with JavaScript on, and
  fails on any security-policy violation.

## Risks / Trade-offs

- [An anonymous script exhausts the Worker's free quota of 100,000 requests a day. Every
  request counts, 404s and preflights included, and `workers.dev` has no rate limiting.
  About 1.2 requests a second makes drill-downs fail until the daily reset] → Accepted on
  2026-10-06. Brazil and state pages are static and keep working. Luiz watches the
  request count in Cloudflare, and moves the account to Workers Paid ($5 a month,
  10 million requests included) on the first day it is abused.
- [A compromised dependency or action steals a token] → The build job holds no secrets,
  the upload job installs nothing, actions are pinned by SHA, both environments wait
  for Luiz's approval, and the app pins the manifest's checksum. A bucket lock closes the
  rest if the plan offers one.
- [Runner disk space for unzipped CSVs] → One state at a time (D-B). The first publish
  run logs peak disk use.
- [TSE republishes a file with corrections] → The publish build never reuses a cache, so
  the new file's SHA-512 lands in the next manifest. Nothing silently changes under a
  pinned version.
- [`'unsafe-inline'` weakens the security policy against injected scripts] → Accepted,
  with the mitigations in D-F.
- [DuckDB-WASM adds several MB of JavaScript and wasm] → Only drill-down views load it.
  Brazil and state pages are plain HTML.
- [Deputy files are large in São Paulo] → Sorted rows and row-group statistics let a
  station query read a few hundred KB. The first measurement goes into the PR that adds
  the web views.
- [Party-list and turnout totals per municipality are not checked against an independent
  TSE file] → They are sums of station-checked figures, grouped by code that check 2
  tests. When TSE publishes the municipality and zone files for them, the check is added.
- [The turnout-count mapping in D-C is confirmed only for President] → If the first full
  build fails it for another race, the build stops and the mapping is corrected.
  Nothing publishes in between.
- [TSE changes its station deep-link format] → One function builds the link, and a test
  pins the format. A break only affects an outbound link.
- [The subdomain is taken over after the Vercel project is removed] → The launch notes
  say to delete the GoDaddy CNAME before removing the project.

## Migration Plan

This is a new system. The first deployment goes in this order:

1. Luiz creates the R2 bucket, the two tokens and the two GitHub environments with himself
   as reviewer, and adds a bucket lock if the plan offers one.
2. Merge the Worker, and approve its deployment.
3. Run the publish workflow for `data`, approving the upload. Note the data version and
   its manifest's SHA-256.
4. Merge the web app's first PR, which adds the `duckdb-wasm` target, and publish that
   target, approving the upload.
5. Pin the data version and its checksum in `web/`, then create the Vercel project on
   `web/`, add the CNAME at GoDaddy, and set the team slug in the Worker's CORS pattern.

Rollback for data is a PR that pins the previous version and its checksum. Rollback for
the Worker is redeploying the previous commit.

## Open Questions

- Should municipality pages also be pre-rendered, for search? That is about 11,000 more
  HTML files. It changes neither the specs nor the data layout, so it can wait until the
  station views work.
- Can the pipeline verify TSE's EdDSA signatures on the results files? It needs TSE's
  public key, which has not been found yet.
- Does the R2 plan on this account offer bucket locks? D-D works either way, and a lock
  only adds protection.
