# Brazilian Election Analysis conventions

Read [README.md](README.md) first for what the project is. Read
[docs/decisions.md](docs/decisions.md) for why it is built this way. This file holds the
rules that are easy to break and expensive to notice.

## Workflow

- **Never push to `main`.** Branch, push the branch, and open a PR with `gh pr create`
  that references the issue it closes. Luiz merges.
- Feature work starts as an OpenSpec change: `/opsx:propose`, `/opsx:apply`,
  `/opsx:archive`. A bug fix or a chore needs only an issue and a PR.
- Never hand-edit `.claude/skills/openspec-*` or `.claude/commands/opsx/`. They are
  generated, and `openspec update` regenerates them when the pinned CLI version moves.
- A change that contradicts a decision in `docs/decisions.md` updates that file in the
  same PR and says why.
- CI must pass before review. Run the same checks locally before pushing.

## Invariants

Breaking one of these is a bug even when the screen looks right.

- **An estimate is never a count.** No public file links one voter's choices across
  races, so a cross-race figure is always an estimate. It is always shown with its range,
  and the word "estimativa" or "estimate" is part of the chart itself, not only a tooltip
  or a caption that a screenshot can crop.
- **No integrity claims.** Nothing scores a polling station or machine as suspicious, and
  nothing projects a runoff.
- **Before 2026-10-25, estimates stay behind their flag** unless all five conditions in
  decision D16 hold.
- **Official numbers reconcile, or nothing publishes.** Candidate votes sum to valid
  votes, and polling-station totals sum to TSE's published aggregates. On a mismatch the
  pipeline fails. It never drops or adjusts rows to make the numbers agree.
- **Only GitHub Actions publishes data.** Each publish writes a new, immutable version
  with a manifest of sources and checksums. Nothing overwrites a published version.
- **The app reads only its pinned data version**, through the Worker. The browser never
  requests TSE directly.
- **TSE gets credit wherever its data appears**, as CC BY requires. Use the credit line in
  `DATA_LICENSE.md`.
- **Every user-facing string exists in Portuguese and English.** Portuguese is the
  default.
- **The app stays non-commercial.** It credits the author and never promotes LC Labs
  services, because Vercel Hobby allows personal non-commercial use only.
- **Analytics loads only after consent.**
- **Never commit TSE downloads or pipeline outputs.** Small test fixtures are the only
  exception.

## Domain

- A **seção** (polling station) is the smallest unit with published results. It is
  identified by state, municipality code, zone and section number. Do not assume one
  machine per seção. TSE can aggregate small seções onto one machine, and it replaces a
  machine that fails.
- TSE and IBGE use different municipality codes. Join the two through the `cdi` field in
  TSE's municipality list, never by name.
- **BU** (boletim de urna) is a machine's signed tally. **RDV** (registro digital do voto)
  is its ballot record, sorted within each race. Both are ASN.1 DER files.
- Election codes for 2026: President `6257`, round two `6258`. State races `6259`, round
  two `6260`. The pleito for the first round is `3220`.
- TSE's CSV files are Latin-1, separated by `;`. Text is quoted and numbers are not.

## Structure

- `research/` holds prototypes. Nothing imports from it.
- Each of `pipeline/`, `web/` and `worker/` owns its own toolchain and tests.
- The schema between the pipeline and the app is the contract. A change to it updates
  both sides in the same PR.

## Comments

Comment why, not what. Prefer few. Module headers are one or two sentences. No spec
cross-references and no future-work notes. Those belong in issues and commit messages.
