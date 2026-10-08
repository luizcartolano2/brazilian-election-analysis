# Worker

Serves published data from the R2 bucket `eleicoes-data` to the app. It answers `GET` and
`HEAD` for files under `v/<version>/`, `assets/duckdb-wasm/<version>/` and
`assets/geo/<edition>/`, and it honors a single byte range. It sends CORS headers to the app's origins only. It never lists, writes
or deletes anything.

## Test it

The toolchain needs Node 22.12 or a later 22.x, or Node 24 or later. Node 23 is not supported.

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

To roll back, use Rollback on the Worker's Deployments page in Cloudflare, or re-run an
older "Deploy Worker" run, which deploys that run's commit. GitHub allows a re-run for 30
days. Then merge a revert PR, so that `main` matches what is live. A manual trigger of the
workflow always deploys the head of `main`.

## Origins

CORS allows only `https://eleicoes.luizcartolano.com` and `http://localhost:3000`. Vercel
previews get no CORS headers. Anyone can claim a free `*.vercel.app` alias, so no pattern
can tell this project's previews from a look-alike. In a preview, the static pages work and
the drill-downs do not. Test the drill-downs locally.
