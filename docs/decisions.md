# Decisions

These decisions were agreed on 2026-10-06, before any code existed. Each one records the
reason, because the reason is what tells a later reader whether it still holds.

To change a decision, change this file in the same PR as the work that needs the change,
and say why in the PR. A feature that depends on a decision cites it by number.

## Purpose

### D1. Public but unpromoted

The project serves three goals at once: a showcase of turning messy public data into
honest analysis, public-interest analysis of the 2026 election, and a way to learn the
methods. It is public, but nobody advertises it.

### D2. Indexed, with no promotion

Search engines index the app. lclabs-web links to it from a Projects card and a blog
post. There is no header link on lclabs-web and there are no social posts.

**Why:** a showcase that nobody can find has no value, and an honest methods page holds
up to scrutiny. An unlisted page would protect the author more but drop the public value.

## Placement and naming

### D3. A standalone app plus a post on lclabs-web

The app runs on its own subdomain, as PitStop Club does. A data-story post on lclabs-web
tells the story and links into the app.

### D4. One repository for pipeline, app and worker

The layout is `pipeline/` (Python), `web/` (the app), `worker/` (the data edge) and
`docs/`.

**Why:** the schema between the pipeline and the app is the part most likely to change.
In one repository a schema change and its UI change land in one PR and one CI run.

### D5. Names

The app lives at `eleicoes.luizcartolano.com`, with the election year in the path:
`/2026/...`. The repository is `luizcartolano2/brazilian-election-analysis`.

**Why:** the domain is Portuguese because the site is Portuguese first (D11). The year
stays out of the domain and the repository name, so a later cycle needs no rename. This
does not commit the project to a later cycle.

### D6. Public repository, MIT license

The code is MIT. TSE publishes its open data under CC BY, so every use credits TSE. See
[`DATA_LICENSE.md`](../DATA_LICENSE.md).

**Why:** an estimate of how people voted is only credible if someone else can rerun it.

## Data and hosting

### D7. Parquet queried in the browser, from the first release

Section-level data ships as Parquet files. Visitors' browsers query them with
DuckDB-WASM. There is no database and no application server.

**Why:** a narrow, sorted Parquet layout measured 1.2 bytes per row on real 2026 data.
The President race for every polling station in Brazil (3.8 million rows) is 4.8 MB. The
whole first round, every race, is about 110 MB. In Postgres the same data would need 6 to
7 GB. Supabase Free allows 500 MB and pauses a project after one week without traffic,
which an unpromoted site will reach. Supabase Pro starts at $25 a month for data that
never changes after the election.

### D8. Cloudflare R2 stores the files, with a Hugging Face mirror later

R2 is the source of truth that the app reads. The same files can later be published as a
Hugging Face dataset for reuse.

**Why:** R2's free tier covers 10 GB of storage and 10 million reads a month, with no
egress fees. The app does not depend on a host whose CORS and rate limits we cannot
control.

### D9. A Cloudflare Worker on workers.dev serves the files

A small Worker streams byte ranges from R2 and sets CORS for the app's origin.

**Why:** the domain's DNS is at GoDaddy. An R2 custom domain requires the domain to be a
Cloudflare zone, and the public `r2.dev` URL is rate-limited and meant for development
only. The Worker free plan allows 100,000 requests a day, with no DNS changes. If DNS
moves to Cloudflare later, the data URL changes in configuration only.

### D10. The app is a Next.js 16 static export on Vercel

The stack matches PitStop Club: Next.js 16, Tailwind 4, TypeScript, npm and Node 22. The
app is a new Vercel project, reached by a CNAME at GoDaddy.

**Why:** the app has no server work, so a static export is enough. The same stack across
projects keeps one set of conventions. Vercel Hobby allows non-commercial personal use
only, so the app credits the author and never promotes LC Labs services.

### D11. Portuguese by default, English in step

Portuguese is at the root and English is under `/en`. Every string exists in both
languages, and a test fails when the two drift apart.

**Why:** the data and the public-interest audience are Brazilian, while the showcase
audience may not be. Adding a second language to a static export later means reworking
every route.

## Pipeline and publishing

### D12. Toolchain

The pipeline uses Python 3.12 with uv, DuckDB, numpy, scipy, pytest and ruff. The web app
uses Vitest, and Playwright tests of the built site under its production headers. The Worker uses `wrangler` as a local
dependency. GitHub Actions runs the checks on every PR.

Test-only tools are allowed when a test cannot run without them, and they stay in their
own dependency group. The upload script's tests use `moto` and `boto3` as a local S3
server, in the pipeline's `upload-tests` group, so the publish build job never installs
them. Changed on 2026-10-07, when the publishing workflow needed a tested upload.

**Why:** DuckDB reads TSE's Latin-1 CSV files directly and writes Parquet. It is also the
engine that runs in the browser, so one query can be tested on both sides.

### D13. Only GitHub Actions publishes data, to immutable versions

A manual workflow on `main` downloads from TSE, builds, tests and uploads. Each run writes
a new versioned prefix with a `manifest.json` that records the pipeline commit, every TSE
source URL with its SHA-512, and the download time. The app pins one data version, so a
data upgrade is a reviewed PR and a rollback is a revert.

**Why:** "these numbers were built by commit X on a clean machine" is the claim the
methodology page rests on. Local runs are for development and cannot publish.

On 2026-10-09, the runoff change `add-runoff-results` moved the pin to one version for
each round, because a recount of round 1, such as Rio's, must republish round 1 without
touching round 2. Each version still holds one round, and the build fails unless the two
pins agree on who reached round 2.

## Scope and timing

### D14. Ship something before the runoff, with no hard date

The second round is on 2026-10-25. Something ships before it. There is no fixed date for
the rest.

On 2026-10-08, after the first release went live, Luiz added a second target: maps and
a search box, in the change `add-maps-and-search`, merge by 2026-10-23. That leaves the
runoff weekend free of deploys.

On 2026-10-08, Luiz approved a redesign, in the change `redesign-results-pages`. It has
the same target, a merge by 2026-10-23, and lands before the runoff change, which reuses
its result cards. The date applies to each of its three PRs alone. A PR that misses it
waits until the runoff change merges. If the last PR misses it, its requirements move to
a follow-up change, so the runoff change builds on archived specs.

On 2026-10-09, Luiz agreed the runoff change, `add-runoff-results`. Its code merges by
2026-10-23, and nothing deploys from 2026-10-24 to 2026-10-26. The round-2 data publishes
after TSE's open data holds the round, and a PR pins it after the freeze. A recount of
round 1, such as Rio's, publishes round 1 alone, outside the freeze.

On 2026-10-09, Luiz agreed `shrink-page-payloads`, which moves the Brazil map's values and
the candidate pages' share maps and lists out of the pages. Its code merges by 2026-10-16,
so that it runs in production for a week before the freeze. If it misses 2026-10-23, it
waits until the round-2 pin and its live checks are done, so that the pin PR never
changes two things at once.

### D15. The pre-runoff release shows official results

The first release explores official first-round results, down to the polling station, on
the full infrastructure. Cross-race estimates are a stretch goal for it.

### D16. Estimates go public before the runoff only behind five conditions

Before 2026-10-25, an estimate is public only if all five conditions hold:

1. CI runs the synthetic-accuracy test with a fixed error threshold.
2. The range and the word "estimativa" (or "estimate") are part of the chart itself, so a
   cropped screenshot still shows both.
3. The methodology page exists in both languages.
4. The races are President × Governor and President × Senate only.
5. No text or chart frames where any candidate's voters will go in the runoff.

**Why:** an estimate published days before a runoff can be screenshotted without its
range and used as a claim about voters.

### D17. Non-goals

Never, in any version:

- No fraud or anomaly scores for polling stations or machines
- No runoff projections
- No cross-race combination stated as a count of people

Not in the first version:

- No analysis of per-machine files (tallies, ballot records, logs)
- No accounts, comments, saved views or live election-night results
- No comparison with elections before 2026

### D18. lclabs-web gets a card first and a post later

The Projects card goes up with the first public release. The data-story post comes after
the runoff, when the estimates and the round-to-round transfers exist.

### D19. The post uses static SVG charts

Charts in the post are SVGs exported from the app, each linking to its live view. The
range and the label are part of the SVG.

**Why:** lclabs-web's Content Security Policy allows data requests to its own origin only.
Static charts need no policy change and no new dependency there.

## Process and quality

### D20. The PitStop Club process

OpenSpec drives every feature, from the first commit. Work is tracked in GitHub issues.
Every change reaches `main` through a PR. The invariants live in [`CLAUDE.md`](../CLAUDE.md).

### D21. Tests and the authors review the method

No outside reviewer reads the method before publication. The methodology page says so,
and it links to the issue tracker for anyone who disputes a number.

## Analytics

### D22. Google Analytics 4 with Consent Mode

Analytics starts denied and turns on only after the visitor accepts a banner in
Portuguese or English. A privacy notice in both languages covers what the LGPD requires.
The app's Content Security Policy allows Google's tag domains.
