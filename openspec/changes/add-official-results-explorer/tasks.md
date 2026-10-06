## 1. Setup outside the repository (Luiz)

- [ ] 1.1 Create a Cloudflare account and an R2 bucket named `eleicoes-data`
- [ ] 1.2 Create an R2 API token with write access to that bucket only
- [ ] 1.3 Create a custom Cloudflare API token limited to Workers Scripts edit, not the "Edit Cloudflare Workers" template
- [ ] 1.4 Create the GitHub environments `data-publish` and `worker-deploy`, each limited to `main` with Luiz as required reviewer, and add each token to its environment
- [ ] 1.5 Check whether the account's R2 plan offers bucket locks, and if it does, add a lock rule with no expiry on `v/` and `assets/`
- [ ] 1.6 Install uv locally (`brew install uv`)

## 2. Pipeline: dataset (one PR)

- [ ] 2.1 Create the uv project in `pipeline/` with DuckDB, numpy, scipy, pytest and ruff, add the `pipeline` CI job with `uv sync --locked`, and pin every action in `ci.yml` to a commit SHA
- [ ] 2.2 Add the source list for elections 6257, 6259 and 6261, including `votacao_candidato_munzona_2026` and the per-municipality council aggregate, and the downloader that caches under `pipeline/data/cache/` and records SHA-512 and download time; test that a failed or truncated download stops the run with no output
- [ ] 2.3 Add the candidate allowlist, the deny-list guard and the sanitized candidate-stage errors; test that the output columns equal the allowlist, that a forbidden column fails the run, and that a parse error message contains no field value
- [ ] 2.4 Build the fixtures from real Acre and Pernambuco files with synthetic, invalid-check-digit identifiers, and add the test that fails on any valid CPF in fixtures or outputs
- [ ] 2.5 Normalize votes, turnout, stations and municipalities with DuckDB, one state at a time; test against the fixtures
- [ ] 2.6 Classify votes from the aggregate's destinations and take outcomes from it; test number 28 as a technical null, a sub judice candidate, a party list in a deputy race, an aggregate outcome that differs from the registry, and that an unknown destination fails the run
- [ ] 2.7 Record aggregated stations with their principal; test that an aggregated station gets no results rows
- [ ] 2.8 Add the station check: choices per voter from the aggregate's total votes over attendance, and type counts against the turnout file; test a one-vote mismatch, the Senate's two choices, the council's seven seats with one choice, and a non-whole ratio
- [ ] 2.9 Add the totals checks against `votacao_candidato_munzona_2026` and the aggregates, including blank, null, technical-null, annulled and sub judice totals; test a municipality mismatch, a state mismatch, and that every mismatch is reported
- [ ] 2.10 Write the Parquet layout and the totals and summary files from design D-A with DuckDB; test that two runs on the fixtures give byte-identical data files
- [ ] 2.11 Write `manifest.json`; test that it lists every data file with size and SHA-256 and every source with URL, SHA-512 and time
- [ ] 2.12 Add the export of web fixtures from the pipeline's fixtures, and the CI check that fails when regenerating them changes anything
- [ ] 2.13 Add the candidate-identifier invariant to `CLAUDE.md`
- [ ] 2.14 Run a full local build for Acre, Roraima and Pernambuco, record sizes and timings in the PR, and open the PR

## 3. Worker (one PR)

- [ ] 3.1 Create the Worker project in `worker/` with wrangler, the R2 binding and Vitest on Miniflare, and add the `worker` CI job
- [ ] 3.2 Validate keys and methods; test 404 for the root, a version path, a missing file, a `..` segment, an encoded slash and a key outside the allowed prefixes, and 405 for write methods
- [ ] 3.3 Honor single byte ranges; test `bytes=a-b`, `bytes=a-` and `bytes=-n` with exact bytes and `Content-Range`, 416 past the end, and 200 with the whole file for several ranges or a malformed header
- [ ] 3.4 Add CORS; test the production origin, a preview of this project, a look-alike preview from another team scope, localhost, a foreign origin, a preflight for `GET` with `Range`, the exposed headers, and `Vary: Origin` on every response
- [ ] 3.5 Set immutable cache headers on version and asset files; test the header
- [ ] 3.6 Add `deploy-worker.yml` through the `worker-deploy` environment with SHA-pinned actions, and open the PR

## 4. Publishing (one PR)

- [ ] 4.1 Add `publish-data.yml`: manual trigger, `main` only, a non-cancelling concurrency group, a `target` input, and SHA-pinned actions
- [ ] 4.2 Add the build job with `contents: read`, no environment, `uv sync --locked`, no cache, and `dist/` handed over as a one-day artifact
- [ ] 4.3 Add the upload job in `data-publish` that runs no project code: verify checksums against the manifest, fail when the version path holds files, upload data files, then `manifest.json`; test the upload script against a local S3 server for an existing path, a checksum mismatch, and the manifest going last
- [ ] 4.4 Add the `duckdb-wasm` target, which publishes the locked package's `.wasm` file to `assets/duckdb-wasm/<version>/`; test that an existing asset path stops it
- [ ] 4.5 Open the PR, merge it, run both targets with Luiz's approval, and record the version, its manifest SHA-256, peak disk use and duration in the PR
- [ ] 4.6 Download the published manifest and two data files through the Worker, and check their SHA-256 against the manifest

## 5. Web: results explorer (one PR, or two if the station views grow large)

- [ ] 5.1 Create the Next.js 16 app in `web/` with static export, Tailwind 4, Vitest and Playwright, a lint rule against `dangerouslySetInnerHTML`, and the `web` CI job with a fixtures build
- [ ] 5.2 Add the two route trees, the `pt` and `en` message files and `t()`; test that the key sets match, that numbers format as `47,03%` and `47.03%`, and that switching language keeps the page
- [ ] 5.3 Add `data-version.ts` with the version name, the manifest's SHA-256 and the Worker URL, and the build-time loader; test that a missing manifest, a wrong manifest checksum and a summary that differs from the manifest each fail the build
- [ ] 5.4 Build the Brazil and state pages with headline results in the HTML; Playwright test that a state page shows its leaders with JavaScript disabled
- [ ] 5.5 Add the results view for a race and area, with invalid-vote lines and TSE's outcome; test the Senate note, the Federal District's race list, the council's seven seats, a sub judice line, the governor race for Brazil offering the state list, and the runoff marking
- [ ] 5.6 Add the address parser; test SQL text in `mu`, a slash and `..` in `uf`, an out-of-range zone and an unknown race, each showing the error state with no query and no file request
- [ ] 5.7 Add the DuckDB-WASM query layer with prepared statements, the worker script in `public/duckdb/` and the `.wasm` from the Worker; test the queries against fixture Parquet
- [ ] 5.8 Add drill-down links and query-parameter addresses; test that a copied station address reopens the same station and race
- [ ] 5.9 Add the station page with the aggregated-station message and the link to TSE's station view; test the link format against the verified example
- [ ] 5.10 Add "find your polling station" by municipality and place name or address; test a partial school name and a search text with quotes
- [ ] 5.11 Add the error state; test that a failed query shows a message and a retry and no numbers
- [ ] 5.12 Add the footer and the sources page; test the TSE credit in both languages, and that the sources page shows the version and links to its manifest
- [ ] 5.13 Add the security headers and the policy in `web/vercel.json` for every path; Playwright test that a station view with JavaScript on and these headers shows results with no policy violation
- [ ] 5.14 Check every page at 360 pixels wide, and open the PR

## 6. Launch (Luiz, with help)

- [ ] 6.1 Create the Vercel project on `web/`, add `eleicoes.luizcartolano.com`, and add the CNAME at GoDaddy
- [ ] 6.2 Set the team slug in the Worker's preview pattern, and approve the redeploy
- [ ] 6.3 Add to the README that the GoDaddy CNAME must be deleted before the Vercel project is ever removed
- [ ] 6.4 Open the live site in both languages on a phone, and spot-check three stations against TSE's own station view
