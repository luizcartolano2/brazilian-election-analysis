# Web

The results explorer: a Next.js static export in Portuguese, at the root, and English,
under `/en`. It reads one pinned data version, which the pipeline published and the Worker
serves.

## Run it

The toolchain needs Node 22.12 or a later 22.x, or Node 24 or later.

```bash
npm ci --ignore-scripts
ELEICOES_DATA=fixtures npm run dev
```

`npm run build` and `npm run dev` first run `scripts/prepare-data.ts`. That script reads the
data version and copies its manifest and summaries into `.data/`, which the pages read at
build time. It takes the data from one of two places:

- By default, from the version that `src/data-version.ts` pins, through the Worker. The
  build fails if the manifest is missing, if its SHA-256 differs from the pin, if it says
  `parcial` or does not say `fontes_tse`, or if any summary differs from its manifest entry.
- With `ELEICOES_DATA=fixtures`, from `fixtures/`, which the pipeline generates from its
  test data. Fixtures have no published version, so only the summaries are checked
  against their manifest. Every page then shows a test-build banner, and the step refuses
  to run on Vercel, where the `VERCEL` variable is set.

## Municipality, zone and station views

These views query the Parquet files in the browser with DuckDB-WASM. `prepare-data.ts`
also copies DuckDB's worker script into `public/duckdb/`, and keeps DuckDB's signed
Parquet extension in `.cache/`, checked against the SHA-256 in `scripts/duckdb-assets.ts`.

- A fixtures build downloads the extension from `extensions.duckdb.org` once, then copies
  the fixtures, DuckDB's `.wasm` module and the extension into `public/_fixtures/`, so the
  views run against the same origin.
- A production build reads both DuckDB assets through the Worker and fails unless they
  match the lockfile and the pin. It caches the Worker's extension and never contacts
  `extensions.duckdb.org`. Publish the `duckdb-wasm` target before the first production
  build, and again after any update of `@duckdb/duckdb-wasm`.

After that update, run DuckDB's `SELECT version()` and, if the version changed, download
the extension for it and update `PARQUET_EXTENSION` in `scripts/duckdb-assets.ts`. The data
step fails until the two agree.

## Maps and candidate pages

`prepare-data.ts` also builds the maps' values. It reads each race's municipality totals and
the candidate registry from the pinned version, and checks each file against the manifest.
It then checks that the municipalities add up to each summary. Any difference fails the
build, and the build lists every one. The step writes `.data/mapas/`: the two most voted
in each municipality for every race map, and each President, Governor and Senate
candidate's votes for their share map.

The browser draws a map with `d3-geo` and `topojson-client` from a boundary file. It draws
only after the file's SHA-256 matches the pin, and shows a message otherwise. Every page
with a map also lists its municipalities in its HTML, so the numbers read without
JavaScript.

`npm run build` ends with `scripts/page-size.ts`, which fails when any page exceeds
2,500,000 bytes.

## Boundaries

The maps use IBGE's Malha Municipal Digital 2025. `geo/stage-geo-assets.ts` simplifies and
projects it, and the "Publish data" workflow publishes it with the target `geo`.
`scripts/geo-assets.ts` pins the source's SHA-512, the staging settings, and the published
build with the SHA-256 of each file.

- A production build fetches the pinned build through the Worker, and fails on a missing
  or changed file. It also joins each file with the data's municipalities.
- A fixtures build serves `fixtures-geo/`, the boundaries of the fixture municipalities,
  from `/_fixtures/geo/`.

To pin a new boundary build, run "Publish data" with the target `geo` and approve the
upload. Then copy the build path and the SHA-256 of each file from its `SHA256SUMS` into
`GEO_BUILD`. To regenerate the fixture boundaries from IBGE's zip, run:

```bash
npx tsx geo/stage-geo-assets.ts fixtures-geo fixtures --fixtures --source BR_Municipios_2025.zip
```

`DATA_LICENSE.md` records IBGE's terms and the credit line that every map shows.

## Search

The search box in each page's header finds municipalities, cities abroad and candidacies.
`prepare-data.ts` builds its index from the checked summaries and municipality list. It
writes the index into `public/busca/<hash>/`, with an allowlist of fields, and `vercel.json`
marks that path immutable. The browser downloads the index the first time a visitor
focuses the box.

## Fonts and names

The app uses Archivo for headings and Public Sans for text, both under the SIL Open Font
License 1.1. The packages `@fontsource-variable/archivo` and
`@fontsource-variable/public-sans` hold them, pinned in the lockfile. `app/fonts.ts`
loads each package's Latin file through `next/font/local`, so the export serves the fonts
from the app's own origin and no page requests Google.

TSE writes the names of candidates, municipalities and cities abroad in capitals.
`src/lib/names.ts` shows them in title case, and keeps acronyms such as PT and PSOL in
capitals. The search index keeps TSE's spelling.

## Test it

```bash
npm ci --ignore-scripts --prefix geo
npm run lint
npm run format:check
npm test
ELEICOES_DATA=fixtures npm run build
npx playwright install chromium
npm run test:e2e
```

The browser tests serve `out/` through `scripts/serve-out.mjs`, which applies the headers
and redirects in `vercel.json`, so they run under the production security policy.

`geo/` holds the script that stages IBGE's boundaries, with its own lockfile, so that
`mapshaper` and its 227 packages stay out of the app's install and Vercel's build. The
unit tests need it installed, as above.

## Deploys

Vercel builds a commit only when something under `web/` changed since the branch's last
successful deployment. `vercel.json` runs `scripts/vercel-ignore-build.sh` as its Ignored
Build Step. A branch's first preview compares its last commit with that commit's parent.
Production builds whenever the script cannot tell. A skipped deployment shows as canceled
and stores no output, which keeps Vercel's Deployment Storage down.

The step assumes that the Vercel project's Root Directory is `web/`. If that setting
moves, Vercel cannot find the script, and every commit builds again without any warning.

## Pin a new data version

A "Publish data" run's summary shows the version and its manifest's SHA-256.

1. Put both in `src/data-version.ts`.
2. Run `npm run build` without `ELEICOES_DATA`, which checks the new version through the
   Worker.
3. Open a PR. Rolling back is a PR that pins the previous version.

If the Worker's origin changes, change it in `src/data-version.ts` and in the
`connect-src` of `vercel.json` together. A test fails when the two differ.
