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
  `Válido` and `Anulado sub judice`. Party lists carry `Válido (legenda)` or, for a whole
  list under appeal, `Anulado sub judice`. Acre's
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
2026/t1/totais/municipio/comparecimento/uf=<UF>.parquet   turnout per municipality and race
2026/t1/totais/zona/cargo=<c>/uf=<UF>.parquet
2026/t1/totais/zona/comparecimento/uf=<UF>.parquet        turnout per zone and race
2026/t1/resumo/br.json
2026/t1/resumo/<uf>.json                        one per state, plus zz
```

The council race is `cargo=25/uf=PE`. The query engine's files live outside versions,
under `assets/duckdb-wasm/<package version>/`: the WebAssembly module as `duckdb-eh.wasm`,
and DuckDB's signed Parquet extension at the path that DuckDB requests,
`extensions/v1.5.4/wasm_eh/parquet.duckdb_extension.wasm`.

The schemas below are new, because no schema exists before this change.

`votos` is sorted by `municipio, zona, secao, tipo, numero`:

| Column | Type | Meaning |
|---|---|---|
| `municipio` | int32 | TSE municipality code |
| `zona` | int16 | Electoral zone |
| `secao` | int16 | Polling station number |
| `tipo` | int8 | 1 candidate, 2 party list, 3 blank, 4 null, 5 technical null, 6 annulled, 7 annulled sub judice |
| `numero` | int32 | TSE's number: the candidate or party typed, 95 for blank, 96 for null, so rows compare one to one with TSE's CSV |
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
  annulled sub judice, for a candidate or for a whole party list. A number missing from
  the aggregate takes its destination from `votacao_candidato_munzona` (`NM_TIPO_DESTINACAO_VOTOS`)
  when it appears there, and is otherwise a technical null. Any other value fails the run,
  and so does a number with two destinations. The candidate's outcome comes from the
  aggregate's `st`. Council candidates are not in `consulta_cand`, so their names and
  parties come from the aggregate.
- **States**: a complete build covers exactly the states in TSE's presidential
  municipality list, abroad included. `--states` builds a subset, marked `parcial` in the
  manifest, without the national presidential check.
- **Write**: DuckDB writes each file with `COPY (... ORDER BY ...) TO ... (FORMAT parquet,
  COMPRESSION zstd, COMPRESSION_LEVEL 9, ROW_GROUP_SIZE ...)`. A test builds the fixtures
  twice and compares every data file's checksum. Alternative rejected: pyarrow as the
  writer. It is one more dependency outside D12, and DuckDB's writer proved deterministic.
- **Fixtures**: small CSVs cut from real files, except that every personal identifier
  column holds a synthetic value with invalid check digits. A test scans every fixture
  and output for an 11-digit number with valid CPF check digits.
- **Candidates**: a registry row matches the aggregate on election, race, state and
  number. The registry drops apostrophes, quotes and ordinal marks that the aggregate
  keeps, so the name decides only among several candidacies on one number. A number the
  aggregate omits takes its destination from `votacao_candidato_munzona`, matched the same
  way. The build fails if a number ends with two classified rows. The registry is read
  with `DISTINCT`, because TSE lists some candidacies twice.
- **Inputs it refuses**: a state code that is not two letters, since codes reach SQL and
  output paths; a municipality the two municipality lists describe differently; a number
  the aggregate and `votacao_candidato_munzona` classify differently. TSE's empty-text
  markers (`#NULO#`, `#NULO`, `#NE#`, `#NE`) become empty values, and a `-1` coordinate
  becomes empty.
- **Cache**: a cached download is reused only if its bytes still hash to the recorded
  SHA-512, so the manifest always describes the bytes the build read. The manifest's
  `fontes_tse` is false when the build read anything other than TSE's own URLs, and the
  publish workflow refuses such a build and any `parcial` one.
- Outputs go to `pipeline/dist/`, which `.gitignore` covers.

Alternative rejected for the whole stage: pandas, as in the prototype. It loads a 1 GB CSV
into memory, and it is a different engine from the browser's.

### D-C. Reconciliation is a stage, not a test

Reconciliation runs inside every build, because it checks TSE's data, not our code:

1. **Per station and race**: the sum of `votos` equals `comparecimento` times the choices
   per voter, which is the aggregate's `v.tv / e.c` for that race and area. A ratio that
   is not a whole number fails the run. The turnout file's counts must also match, and it
   sorts votes by what was typed, not by destination: `legenda` counts every two-digit
   number typed in a deputy race, `nominais` every other number except 95 and 96, and
   `brancos` and `nulos` the blank and null votes. A list vote for a party under appeal,
   or for a party with no list in that state, is therefore `legenda` there, while the
   totals call it annulled sub judice or a technical null. The full build of 2026-10-06
   confirmed this mapping at every station and race.
2. **Per municipality and zone**: each candidate's sum equals
   `votacao_candidato_munzona_2026`.
3. **Per aggregate area** (Brazil and each state, and Fernando de Noronha for the
   council): each candidate's sum equals the aggregate's `vap`, and each party's list
   votes equal that party's `tval`. The valid, party-list, blank, null, technical-null,
   annulled and annulled sub judice sums equal `vv`, `vl`, `vb`, `vn`, `vnt`, `van` and
   `vansj`. `tval` counts a party's list votes whatever their destination: for a party
   under appeal it holds the annulled list votes while `tvtl`, the valid ones, is 0. The
   full build of 2026-10-06 confirmed `tval` for every race.

The aggregates come from
`resultados.tse.jus.br/oficial/ele2026/<eleicao>/dados/<uf>/<area>-c<cargo:4>-e<eleicao:6>-u.json`,
where the area is the state code or, for a municipal election, the state code followed
by the municipality code. The checks also compare attendance and eligible voters with the
aggregate's `e.c` and `e.te`, and require `QT_VOTOS_ANULADOS_APU_SEP` to be 0 at every
station, because no rule here handles votes annulled and counted apart. A failure prints
the first 50 mismatches, writes every one to `reconciliation-report.txt` in the work
directory, and exits non-zero.

The council has no municipality-and-zone check, because TSE publishes no such file for
it. TSE's presidential `votacao_candidato_munzona` file was empty on 2026-10-06, but the
first publish on 2026-10-07 found it filled and checked President in all 28 areas. The
manifest lists the races checked at each level, so a missing check is visible.

Party-list and turnout totals per municipality and zone have no independent TSE file
yet. They are sums of station figures that passed check 1, grouped by the same code that
check 2 tests.

### D-D. Publishing: a build job without secrets, an upload job behind approval

`.github/workflows/publish-data.yml` runs on `workflow_dispatch` only, with input
`target: data | duckdb-wasm`. It has a `concurrency` group per branch without
cancellation, so two publishes never overlap, and a run on another branch cannot replace
one waiting on `main`. Every action is pinned to a commit SHA, and Dependabot keeps
those pins current.

1. **build** runs with `permissions: contents: read` and no environment. It runs
   `uv sync --locked` without the `upload-tests` dependency group, the tests and the full
   build. That group holds `moto` and `boto3`, about 60 packages that only the upload
   script's tests need, so they stay out of the job that writes the data. The build job
   then hands `dist/` to the next job as a workflow artifact with one day of retention.
   For the WebAssembly target, a separate pair of jobs runs `npm ci --ignore-scripts` in
   `web/`, copies the `.wasm` file out of the locked package and downloads DuckDB's
   Parquet extension at its pinned SHA-256, with a `SHA256SUMS` list.
   `.github/scripts/upload-asset.sh` then refuses an asset path that holds `SHA256SUMS`,
   or a file that is not one of the staged assets or differs from it. It uploads only the
   missing files, reads them all back, and uploads `SHA256SUMS` last. A retry after an
   interrupted upload therefore resumes it, and nothing is ever overwritten.
2. **upload** uses the `data-publish` environment. That environment allows `main` only,
   requires Luiz as reviewer, and holds the R2 credentials. The job installs nothing and
   runs no pipeline code. It runs only the runner's preinstalled AWS CLI and
   `.github/scripts/upload-version.sh`, a short script from this repository. The
   `download-artifact` action fetches the build's files. The script then works in this
   order:
   1. It refuses a manifest that is not a JSON object or does not say `parcial: false`
      and `fontes_tse: true`, and a version id that is not `<YYYYMMDD>-<commit>-<run id>`.
      `jq` checks the type of every file entry: the path and the SHA-256 are strings,
      and the size is a whole number. The manifest comes from the job that runs
      third-party code, and bash runs code hidden in a value that reaches its arithmetic,
      so no manifest value is ever compared as a number.
   2. It checks that every listed path passes the Worker's segment check and gives a key
      within R2's 1,024 characters. It then checks that the folder holds exactly the
      listed files, each with its size and SHA-256, and no symlink or other special file.
   3. It lists `v/<id>/` with the S3 API against R2's endpoint, and fails if anything is
      there.
   4. It uploads the data files with `aws s3 cp --recursive`.
   5. It downloads them back and repeats the check from step 2. A file that R2 stored
      wrongly therefore stops the version before it is complete.
   6. It uploads `manifest.json`, reads it back, compares its SHA-256, and writes the
      version and that SHA-256 to the run's summary.

   The script asks the AWS CLI for checksum headers only when the S3 API requires them,
   because R2 has rejected the headers that newer CLI versions send by default. Steps 2
   and 5 check integrity instead. The pipeline CI job runs the script with the real AWS
   CLI against a local S3 server from `moto`, with the `upload-tests` group. An `aws` shim
   on `PATH` records the order of calls, makes the data upload or the read-back fail, and
   alters a stored file, so the tests prove that the manifest goes last and that a failed
   step withholds it. Another test puts a command in a manifest field and checks that it
   never runs. The R2 bucket name is written in the workflow, as it is in
   `worker/wrangler.jsonc`.

   The build job also records its duration and its peak disk use in the run's summary.
   The artifact lasts one day, so an upload that waits longer for approval fails, and
   the publish runs again from the start. Re-running only the upload job reuses the
   build's version id and artifact. That works for an upload that failed before writing
   anything, while the artifact lasts. Re-running all jobs builds again, and after
   midnight UTC it gets a new date and so a new version path. Neither retry overwrites
   anything, because the script refuses a path that holds files.

If the account's R2 plan offers bucket locks, a lock rule on `v/` and `assets/` makes
immutability hold even against a stolen token.

Alternatives rejected: one job that builds and uploads, because then every PyPI package
runs beside the token. `wrangler r2 object put`, because it uploads one object per call
and cannot list for the existence check.

### D-E. Worker

The Worker is a TypeScript module named `eleicoes-data`, with one R2 binding:

- It accepts a key only when it matches `v/<version id>/...` or
  `assets/duckdb-wasm/<version>/...`, every segment uses `[A-Za-z0-9_.=-]`, no segment
  is `.` or `..`, and the raw path holds no encoded slash. It reads the path from the raw
  request URL, because `new URL()` resolves `..` first. It checks this before
  touching storage. The runtime itself resolves `..` and `%2e%2e` segments before the
  Worker runs, as `wrangler dev` with `curl --path-as-is` showed on 2026-10-07. So a
  request with `..` reaches the Worker as the resolved path, and the same checks apply.
- `HEAD` uses `bucket.head()`. `GET` uses `bucket.get(key, { range })` for `bytes=a-b`,
  `bytes=a-` and `bytes=-n`. A start beyond the end, or `bytes=-0`, gets 416. A malformed
  header or several ranges are ignored, and the whole file is returned with 200, as the
  HTTP range standard allows. A request with one well-formed range reads the file's size
  with `head()` first, because the size decides between 206 and 416. That is two R2 reads
  for a range. A malformed header skips the `head()`. Alternative rejected: one `get()`
  with the range, which leaves 416 to R2's error behavior.
- The content type comes from the file extension: `.json`, `.parquet` and `.wasm`. R2
  keeps whatever type the uploader guessed, and a browser compiles WebAssembly while
  streaming only when the type is `application/wasm`. Every response carries
  `X-Content-Type-Options: nosniff`.
- CORS allows only the exact production origin and `http://localhost:3000`. Every
  response carries `Vary: Origin`. The preflight allows `GET`, `HEAD` and the `Range`
  header, and browsers can keep it for a day, because every preflight counts against the
  free quota. Responses expose `Content-Range`, `Content-Length`, `Accept-Ranges` and
  `ETag`.

  Vercel previews get no CORS headers, so a preview shows the static pages but not the
  drill-downs, which are tested locally. Alternative rejected: an origin pattern for this
  project's previews. The first draft's `^https://eleicoes-[a-z0-9-]+-<team slug>\.vercel\.app$`
  matches another team with the slug `evil-<team slug>`. A pattern that requires Vercel's
  9-character commit hash does not help either. Anyone can claim a free `*.vercel.app`
  alias, and `eleicoes-abcdefghi-<team slug>.vercel.app` has exactly the shape of a real
  commit preview. The data is public, so the cost of a look-alike is only browser traffic
  against the quota, but a pattern that promises more than it checks is worse than none.
- An R2 key is at most 1,024 bytes. A longer key makes R2 throw instead of returning
  nothing, so the Worker returns 404 for it before touching storage. Any other R2 error
  returns 503 with the usual `Vary` and CORS headers and no cache header, so the app can
  read the status and show its error state.

Tests run in the Workers runtime through `@cloudflare/vitest-plugin`, which replaced
`@cloudflare/vitest-pool-workers` for Vitest 4, against a local R2 bucket, with traversal
and look-alike-origin payloads. A test that must not read storage passes a bucket that
throws on any call.

The Worker deploys from `.github/workflows/deploy-worker.yml` on pushes to `main` that
touch `worker/`. A test job runs first with no secret. The deploy job runs through the
`worker-deploy` environment, which requires Luiz as reviewer, holds a custom Cloudflare
token limited to Workers Scripts edit, and reads the repository variable
`CLOUDFLARE_ACCOUNT_ID`. Wrangler is third-party code and receives that token. The deploy
job runs no other package code, and it installs with `npm ci --ignore-scripts` from the
lockfile in `worker/`.

The narrow scope limits less than it seems. Whoever holds the token can replace the
Worker, and the replacement can serve any bytes to every visitor, because the app reads
only through the Worker. A replaced script can probably also bind the bucket and write to
it. So the controls that hold are the approval gate, which keeps the token in one job, and
the bucket lock on `v/` and `assets/` from D-D where the plan offers one, which keeps
published versions intact even against a stolen token. A template token adds R2 and other
rights on top, so it stays out.

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
- Pre-rendered pages are `/2026/` for Brazil, `/2026/<uf>/` for each state and `zz`,
  `/2026/<uf>/<race>/` for each race of each state, and `/2026/fontes/`, in both
  languages: 330 pages, plus the 404 files Next writes. Brazil shows President in full,
  links to the votes cast abroad, and offers the state list for the state races. A state shows the leaders of each race and links to the race's own
  page, which lists every candidate. Abroad shows its one race in full. A race page is a
  page of its own because the state deputy race in São Paulo has 1,346 candidates: its
  HTML is about 2 MB, or 86 KB compressed, and 13,000 DOM nodes, which a phone renders
  without horizontal scrolling. No link prefetches: the pages keep no client state, and
  prefetching made one visit to the Brazil page fetch the data of all 28 areas.
- A state page's turnout box names its race, President, because turnout differs between
  races: voters in transit vote for President only. When TSE's eligible voters differ
  from turnout plus abstention, as abroad, a note gives the difference.
- A party's total in a deputy race is its valid candidate votes plus its valid list
  votes, computed from the candidate list. The summary's `votos_candidatos` also counts
  candidates under appeal, so a party table built on it would add up to more than the
  valid votes. Votes under appeal have their own lines: each candidate, each party list
  under appeal, and any remainder that no listed candidate carries. The results model
  fails the build on a destination it does not know, on lines that do not add up to TSE's
  valid votes, and on more votes under appeal than TSE counts. It never adjusts a line.
- The sources page groups TSE's files by host, with each host's terms from
  `DATA_LICENSE.md`: CC BY for the Open Data Portal, and no stated license for the
  results site. A source from any other host fails the build until its terms are
  recorded.
- `web/src/data-version.ts` holds the pinned version name, its manifest's SHA-256 and the
  Worker's base URL. The Worker's origin also appears in the `connect-src` directive of
  `vercel.json`, because Vercel reads that file before any build step runs, so a build
  cannot generate it. A Vitest test fails when the two origins differ. Before `next
  build`, `scripts/prepare-data.ts` fetches the manifest, checks its SHA-256 and its
  `parcial` and `fontes_tse` flags, then checks each `resumo/*.json` against the manifest
  and copies the checked files into `.data/`, where the pages read them. Any difference
  fails the build. With `ELEICOES_DATA=fixtures` it reads `web/fixtures/` instead, for CI,
  and checks the summaries but not the pin, because fixtures have no published version.
  It refuses fixtures when the `VERCEL` variable is set, and a fixtures build shows a
  banner on every page, so sample numbers never pass for results. The step reads only
  the summaries of 2026's first round, and refuses a manifest for any other year or
  round.
- Each language has its own root layout, so an unknown address gets
  `app/global-not-found.tsx`, in both languages. It needs Next's experimental
  `globalNotFound` flag. `vercel.json` redirects `/` and `/en/` to the 2026 pages.
- Municipality, zone and station views are one static page each, `/2026/municipio/`,
  `/2026/zona/` and `/2026/secao/`. Each reads its location from query parameters such as
  `?uf=ac&mu=1066&zn=4&se=77&cargo=governador`. A parser accepts `uf` only from the 27
  states and `zz`, `mu`, `zn` and `se` only as whole numbers in range, each parameter only
  once, and `cargo` only as a race that the place has: the council exists only in
  Fernando de Noronha, municipality 30015. Without `cargo` the view shows President.
  Anything else shows the error state, and no query runs and no file is requested.
- Every SQL statement that reads data is a constant. The file's URL, built only from
  parsed values and the pinned version, is a bound parameter of `read_parquet(?)`, like
  every other value. The one interpolated value is the extension repository's URL, in a
  `SET` statement. That URL comes from the build, never from the address, and the app
  refuses it if it holds a quote. The
  search uses `contains()` on lower-case text without accents, so quotes, `%` and `_` in
  the search box are only letters. Statements run one at a time.
- A view builds a summary-shaped race from the Parquet rows, and passes it through the
  same checks and tables as a state page. A failed check shows the error state.
- State pages list their municipalities, and abroad lists its cities, from
  `municipios.parquet`. The data step checks that file against the manifest and turns it
  into JSON with DuckDB-WASM's Node build.
- DuckDB-WASM's worker script is copied from the locked package into
  `public/duckdb/<package version>/` at build time, because a browser `Worker` must load
  from the page's own origin. The app uses the exception-handling build only, which every
  major browser has supported since late 2021. An older browser sees the error state.
  DuckDB's worker drops a failed module download without rejecting, so the app counts 20
  seconds without a progress report from DuckDB's start as a failure. That window covers
  the worker's start, the module download and its compilation. DuckDB reports nothing until
  two chunks first arrive 20 ms or more apart, and then reports every chunk. With steady
  small packets from a local server, the first report came at most 6.8 seconds into the
  download, in Chromium and WebKit. The measurement did not cover Firefox. At 6x CPU
  throttling, the whole start took 1.7 seconds. A request for the extension or a data file
  can hang without failing. DuckDB sends it inside the worker with no timeout, so the view
  then stays loading.
- DuckDB-WASM reads Parquet only through its `parquet` extension, which DuckDB fetches when
  it loads. The Worker serves DuckDB's signed extension next to the `.wasm` file, under
  `assets/duckdb-wasm/<package version>/`. `web/scripts/duckdb-assets.ts` pins its SHA-256,
  DuckDB checks its signature on `LOAD`, and the app turns automatic loading off. Both
  files come through the Worker, which keeps the largest downloads off Vercel's monthly
  bandwidth, where Hobby has no overage and pauses the project instead. Alternative
  rejected: allowing `extensions.duckdb.org` in `connect-src`, which would make every
  visitor's browser depend on, and contact, a third-party host at run time.
- The production build downloads both assets through the Worker and compares them with
  the lockfile's module and the pinned extension. A missing or different asset fails the
  build, so the `duckdb-wasm` target must be published before the first production build.
  The build then caches the Worker's extension, so its own queries load the copy that
  browsers load, and a production build never contacts `extensions.duckdb.org`.
- A fixtures build serves the fixtures and the DuckDB assets from the app's own origin,
  under `/_fixtures/`, so CI runs the views under the same security policy.
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

- **pipeline**: `uv sync --locked --group upload-tests`, ruff, `shellcheck` on the
  upload script, and pytest with the upload script's tests required. This covers the CPF scan, the
  determinism test and the check that regenerated web fixtures match the committed ones.
  The fixture builder recomputes TSE's totals with the pipeline's own classification, so
  on fixtures the municipality and aggregate checks prove only self-consistency. The
  independent check is the full build against TSE's real files, which every publish run
  performs before it uploads anything.
- **worker**: typecheck, Vitest, and a Wrangler dry-run bundle that needs no credentials.
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
- [TSE publishes a case none of the rules covers yet] → An unknown destination stops the
  build, and so does any mismatch. Three such cases surfaced on 2026-10-06 and each failed
  the build until the rule was fixed. Nothing publishes in between.
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
   `web/`, and add the CNAME at GoDaddy.

Rollback for data is a PR that pins the previous version and its checksum. Rollback for
the Worker is Rollback on its Deployments page in Cloudflare, or a re-run of an older
"Deploy Worker" run, which deploys that run's commit. A revert PR then brings `main` in
line with what is live. A manual trigger always deploys the head of `main`.

## Open Questions

- Should municipality pages also be pre-rendered, for search? That is about 11,000 more
  HTML files. It changes neither the specs nor the data layout, so it can wait until the
  station views work.
- Can the pipeline verify TSE's EdDSA signatures on the results files? It needs TSE's
  public key, which has not been found yet.
- Does the R2 plan on this account offer bucket locks? D-D works either way, and a lock
  only adds protection.
