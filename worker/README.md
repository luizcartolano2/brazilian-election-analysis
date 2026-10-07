# Worker

Serves published data from the R2 bucket `eleicoes-data` to the app. It answers `GET` and
`HEAD` for files under `v/<version>/` and `assets/duckdb-wasm/<version>/`, and it honors a
single byte range. It sends CORS headers to the app's origins only. It never lists, writes
or deletes anything.

## Test it

Wrangler needs Node 22 or later.

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
```

The tests run inside the Workers runtime against a local R2 bucket, through
`@cloudflare/vitest-plugin`.

Install with `npm ci`. The npm 10 that comes with Node 22 crashes when it resolves this
project's peer dependencies, so update the lockfile with `npx npm@11 install`.

## Try it locally

```bash
npx wrangler r2 object put eleicoes-data/v/test/2026/t1/resumo/br.json --file <a file> --local
npx wrangler dev
curl -H "Range: bytes=0-99" http://localhost:8787/v/test/2026/t1/resumo/br.json
```

## Deploy

Only `.github/workflows/deploy-worker.yml` deploys. It runs on a push to `main` that changes
`worker/`, and it waits until Luiz approves the `worker-deploy` environment. That
environment holds the secret `CLOUDFLARE_API_TOKEN`, a custom token limited to Workers
Scripts edit. The workflow also reads the variable `CLOUDFLARE_ACCOUNT_ID`.

To roll back, redeploy the previous commit with the workflow's manual trigger.

## Preview origins

`VERCEL_TEAM_SLUG` in `wrangler.jsonc` is empty, so no Vercel preview can read data. Set it
to the scope slug of the Vercel project once that project exists. The project must be
named `eleicoes`.

The Worker accepts only commit previews, `https://eleicoes-<9-character hash>-<slug>.vercel.app`.
A branch preview is refused, because another Vercel team can create a branch preview whose
URL ends in the same slug.
