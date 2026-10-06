## Why

The runoff is on 2026-10-25, and D14 commits to shipping something before it. The first
release is the part with no methodological risk: official first-round results,
explorable from the whole country down to a single polling station (D15). It is also
the release that stands up the whole stack (D4, D7 to D13), so everything after it only
adds analysis.

## What Changes

- A Python pipeline downloads TSE's files for every first-round race, including
  Fernando de Noronha's Conselheiro Distrital race, a municipal-type election held the
  same day. It keeps only the columns the app needs, and it classifies votes exactly as
  TSE's aggregates do: valid, party list, blank, null, technical null, annulled and
  annulled sub judice. It checks every number against TSE's own totals, per polling
  station, per municipality and zone, per state and for Brazil, and fails rather than
  publishes on any mismatch.
- A GitHub Actions workflow is the only way to publish, and each run waits for Luiz's
  approval. Third-party code builds the data in a job that holds no credentials. A
  separate job uploads a new, immutable data version to Cloudflare R2, with a manifest
  of sources, checksums and the pipeline commit.
- A Cloudflare Worker serves those files to browsers, with byte ranges and CORS limited
  to the app's own origins.
- A static Next.js app at `eleicoes.luizcartolano.com/2026/`, in Portuguese and English,
  shows results for every race at every level: Brazil, state, municipality, zone and
  polling station. A visitor can find their own polling station by municipality and
  place name. The app pins one data version by name and by manifest checksum, queries it
  in the browser with DuckDB-WASM, and accepts only validated values from its address.
- Every page credits TSE, and a sources page explains where each number comes from.
- `CLAUDE.md` gains one invariant: candidates' CPF, voter-ID number and other personal
  identifiers never leave the pipeline, nor reach fixtures or logs. TSE publishes them
  unmasked in `consulta_cand_2026`. Its domain notes gain election `6261`.

## Non-goals

- No cross-race estimates. They get their own change, under the D16 conditions.
- No map. The polling-place coordinates are kept in the data so a later change can add one.
- No second round. The pipeline takes the round as a parameter so the runoff needs no
  redesign, but this change publishes round 1 only.
- No analytics. GA4 with consent (D22) gets its own change.
- No per-machine files, no comparison with earlier elections, no write paths (D17).
- No election-day operations data, although `detalhe_votacao_secao` carries some, such as
  the time each tally reached TSE and the machine model.
- No paid Cloudflare plan. The availability risk of the free Worker quota is accepted, and
  the design records when to upgrade.

## Capabilities

### New Capabilities

- `results-dataset`: the pipeline that turns TSE's round-1 files into reconciled Parquet
  and summary files, with an allowlist of columns.
- `data-publishing`: publishing immutable data versions to R2 from GitHub Actions only,
  and serving them to browsers through the Worker.
- `results-explorer`: the bilingual static app that explores official results from
  Brazil down to a polling station.

### Modified Capabilities

None. No specs exist yet.

## Invariants touched

| Invariant in `CLAUDE.md` | How this change keeps it |
|---|---|
| Official numbers reconcile, or nothing publishes | The pipeline compares its figures with TSE's totals per station, per municipality and zone, per state and for Brazil, and exits non-zero on any mismatch |
| Only GitHub Actions publishes data | The R2 credentials are secrets of the `data-publish` environment, which only `main` can use and which waits for Luiz's approval. The job that builds the data has no access to them |
| The app reads only its pinned data version | The app pins a version name and its manifest's SHA-256. The build fails when either does not match, and the Worker serves only versioned paths |
| TSE gets credit wherever its data appears | A credit line in every page footer and in every published manifest |
| Every user-facing string exists in Portuguese and English | One message file per language, and a test that fails when their keys differ |
| The app stays non-commercial | The footer credits the author and links to the repository, nothing else |
| Never commit TSE downloads or pipeline outputs | `.gitignore` covers the download cache and extracted files under `pipeline/data/` and the outputs under `pipeline/dist/`. Fixtures carry synthetic identifiers only |
| Candidate personal identifiers never leave the pipeline (new) | An allowlist of columns, a guard that fails on a forbidden column, error messages without row content, and a test that fails on any valid CPF in fixtures or outputs |
| An estimate is never a count | Not touched: this change shows no estimates |
| Analytics loads only after consent | Not touched: this change ships no analytics |

All user-facing text ships in Portuguese and English.

## Impact

- New folders: `pipeline/`, `worker/`, `web/`, and the workflows `publish-data.yml` and
  `deploy-worker.yml`.
- New CI jobs for the pipeline, the Worker and the app. Every action is pinned to a
  commit SHA.
- External setup that only Luiz can do: a Cloudflare account with an R2 bucket and two
  narrowly scoped tokens, two GitHub environments with Luiz as required reviewer, a
  Vercel project, and a CNAME record at GoDaddy for `eleicoes.luizcartolano.com`.
- Each publish run downloads about 3.5 GB from TSE.
