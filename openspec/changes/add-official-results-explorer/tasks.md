## 1. Setup outside the repository (Luiz)

- [ ] 1.1 Create a Cloudflare account and an R2 bucket named `eleicoes-data`
- [ ] 1.2 Create an R2 API token with write access to that bucket only, and a Cloudflare API token that can deploy Workers
- [ ] 1.3 Create the GitHub environments `data-publish` and `worker-deploy`, each limited to the `main` branch, and add the tokens as their secrets
- [ ] 1.4 Install uv locally (`brew install uv`)

## 2. Pipeline: dataset (one PR)

- [ ] 2.1 Create the uv project in `pipeline/` with DuckDB, pyarrow, numpy, scipy, pytest and ruff, and add the `pipeline` CI job
- [ ] 2.2 Add the source list and the downloader that caches by URL and records SHA-512 and download time; test that a failed or truncated download stops the run with no output
- [ ] 2.3 Add the candidate allowlist and the deny-list guard; test that the output columns equal the allowlist and that a CPF, voter-ID, email or birth-date column fails the run
- [ ] 2.4 Normalize votes, turnout, stations and municipalities with DuckDB, one state at a time; test with fixture CSVs cut from real Acre files
- [ ] 2.5 Classify vote types, including technical nulls from TSE's aggregate list; test number 28 as a technical null and a two-digit number in a deputy race as a party list
- [ ] 2.6 Record aggregated stations with their principal; test that an aggregated station gets no results rows
- [ ] 2.7 Add the reconciliation stage for stations (votes equal attendance times `nv`) and for totals (candidates, blank, null and technical null against the aggregates); test a one-vote mismatch, the Senate's two choices, and that every mismatch is reported
- [ ] 2.8 Write the Parquet layout and the totals and summary files from design D-A; test that two runs on the same fixtures give byte-identical files
- [ ] 2.9 Write `manifest.json`; test that it lists every output file with size and SHA-256 and every source with URL, SHA-512 and time
- [ ] 2.10 Add the candidate-identifier invariant to `CLAUDE.md`
- [ ] 2.11 Run a full local build for Acre and Roraima, record the sizes and timings in the PR, and open the PR

## 3. Worker (one PR)

- [ ] 3.1 Create the Worker project in `worker/` with wrangler, the R2 binding and Vitest on Miniflare, and add the `worker` CI job
- [ ] 3.2 Serve `GET` and `HEAD` for files inside a version path only; test 404 for the root, a version path and a missing file, and 405 for write methods
- [ ] 3.3 Honor single byte ranges; test 206 with the exact bytes and `Content-Range`, and 416 past the end
- [ ] 3.4 Add CORS for the allowed origins only; test the production origin, a preview origin, localhost and a foreign origin
- [ ] 3.5 Set immutable cache headers on version files; test the header
- [ ] 3.6 Add `deploy-worker.yml` through the `worker-deploy` environment, and open the PR

## 4. Publishing (one PR)

- [ ] 4.1 Add `publish-data.yml`: manual trigger, `main` only, `data-publish` environment, round as an input
- [ ] 4.2 Run the pipeline tests and the full build before any upload, and stop on failure
- [ ] 4.3 Fail when the version path already holds files, upload the data files, then upload `manifest.json` last
- [ ] 4.4 Open the PR, merge it, run the workflow, and record the version, peak disk use and duration in the PR
- [ ] 4.5 Download the published manifest and two data files through the Worker, and check their SHA-256 against the manifest

## 5. Web: results explorer (one PR, or two if the station views grow large)

- [ ] 5.1 Create the Next.js 16 app in `web/` with static export, Tailwind 4, Vitest and Playwright, and add the `web` CI job with a fixtures build
- [ ] 5.2 Add the two route trees, the `pt` and `en` message files and `t()`; test that the key sets match and that numbers format as `47,03%` and `47.03%`
- [ ] 5.3 Add `data-version.ts` with the pinned version and the Worker URL, and the build-time loader for `resumo/*.json`
- [ ] 5.4 Build the Brazil and state pages with headline results in the HTML; Playwright test that a state page shows its leaders with JavaScript disabled
- [ ] 5.5 Add the results view for a race and area: candidates by votes, shares of valid votes, blank, null, technical null, attendance, abstention and TSE's outcome; test the Senate note and the Federal District's race list
- [ ] 5.6 Self-host DuckDB-WASM in `public/duckdb/` and add the query layer for the municipality, zone and station views; test the queries against fixture Parquet
- [ ] 5.7 Add drill-down links and query-parameter addresses; test that a copied station address reopens the same station and race
- [ ] 5.8 Add the station page with the aggregated-station message and the link to TSE's station view; test the link format against the verified example
- [ ] 5.9 Add "find your polling station" by municipality and place name or address
- [ ] 5.10 Add the error state, so a failed query shows a message and a retry and no numbers
- [ ] 5.11 Add the footer and the sources page with TSE's credit, licenses, the data version and the manifest link
- [ ] 5.12 Add security headers and the CSP in `web/vercel.json`
- [ ] 5.13 Check every page at 360 pixels wide, and open the PR

## 6. Launch (Luiz, with help)

- [ ] 6.1 Create the Vercel project on `web/`, add `eleicoes.luizcartolano.com`, and add the CNAME at GoDaddy
- [ ] 6.2 Add the production origin and the preview pattern to the Worker's CORS list if they differ from the defaults, and redeploy
- [ ] 6.3 Open the live site in both languages on a phone and spot-check three stations against TSE's own station view
