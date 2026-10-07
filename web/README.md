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

## Test it

```bash
npm run lint
npm run format:check
npm test
ELEICOES_DATA=fixtures npm run build
npx playwright install chromium
npm run test:e2e
```

The browser tests serve `out/` through `scripts/serve-out.mjs`, which applies the headers
and redirects in `vercel.json`, so they run under the production security policy.

## Pin a new data version

A "Publish data" run's summary shows the version and its manifest's SHA-256.

1. Put both in `src/data-version.ts`.
2. Run `npm run build` without `ELEICOES_DATA`, which checks the new version through the
   Worker.
3. Open a PR. Rolling back is a PR that pins the previous version.

If the Worker's origin changes, change it in `src/data-version.ts` and in the
`connect-src` of `vercel.json` together. A test fails when the two differ.
