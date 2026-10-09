## Why

The runoff is on 2026-10-25: President everywhere, abroad included, and Governor in
seven states (AC, AM, DF, ES, RJ, RN and TO). The site shows only the first round, and
every page assumes it. Each round has its own TSE election codes and its own rows in
TSE's files, and the app checks that its pinned version holds round 1.

Rio de Janeiro's runoff depends on a court ruling. Garotinho's candidacy is sub judice,
so TSE annulled its 274,411 votes. Without them, Douglas Ruas has 50.88% of the valid
votes. With them, Ruas has 49.27%. If the courts settle the case, TSE recounts round 1
for Rio, and the site needs a new round-1 version without touching round 2.

D14 places this change after the redesign, which merged on 2026-10-09, and leaves the
runoff weekend free of deploys. So the round-2 results land after that freeze, from TSE's
open data, and D17 rules out live results on the night. TSE says its open-data portal
publishes within five days of an election.

## What Changes

- The pipeline builds round 2: President under election code 6258 and the state races
  under 6260, with no municipal race. A state's round-2 races come from TSE's own vote
  rows, so a state without a Governor runoff gets President only.
- Each published version holds one round, as its manifest already records. The publish
  workflow gains a round input. Rio's recount republishes round 1 alone.
- The app pins one version per round, and the build fails unless the two pins agree on
  who reached round 2. This amends D13, which said one version.
- Until a round-2 version is pinned, every round-2 page states the runoff's date and
  says that the official results appear once TSE publishes them. It shows no vote count
  or share.
- Round-2 pages live under `/2026/segundo-turno/`, with the same slug in both languages:
  the Brazil page, a page for each state and abroad, a race page for each runoff, and the
  municipality, zone and station views. Every round-1 address keeps showing round 1.
- `/2026/` stays on round 1. Below its candidate cards, a card leads to round 2: the
  runoff's date before the results, and the round-2 headline after them.
- The header's round chip becomes a switch between the rounds. It leads to the same area
  and race in the other round when that page exists, else to the same area, else to the
  round's Brazil page.
- Headlines follow the round. An elected candidate in round 2 "vence no 2º turno". A
  round-2 card states no runoff date.
- Each finalist keeps its round-1 color in round 2: Brazil's round-1 ranking for
  President, and the state's round-1 ranking for Governor.
- Round 2 gets maps: President by municipality on the Brazil and state pages, and
  Governor by municipality in each runoff state.
- A finalist's candidate page gains a round-2 section, with its own headline, stats,
  share map and largest municipalities. The candidate's address does not change.
- The sources page lists both pinned versions, and a round-2 station links to TSE under
  the round-2 election code.
- All new user-facing text ships in Portuguese and English.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `results-dataset`: the pipeline builds round 2, and finds each state's round-2 races in
  TSE's files.
- `data-publishing`: a version holds one round, and the publish workflow chooses which.
- `results-explorer`: the round-2 pages, their addresses, the round switch, the link
  from round 1, a pinned version per round, and round-aware headlines.
- `results-maps`: the round-2 maps, the round-1 colors in round 2, and the round-2
  section of a candidate page.

## Invariants

This change touches these invariants in `CLAUDE.md`, and it keeps each one as follows:

- An estimate is never a count. The change shows no estimate.
- No integrity claims. Nothing projects the runoff, before or after it. Before TSE
  publishes, the round-2 page shows the date and no number.
- Official numbers reconcile, or nothing publishes. Round 2 goes through the same
  reconciliation as round 1. A half-updated set of TSE files, for example during Rio's
  recount, fails the publish.
- Only GitHub Actions publishes data. Each round publishes through the same protected
  workflow, into a new immutable version.
- The app reads only pinned data. It reads one pinned version per round, through the
  Worker, and the files that its build derives from them. The invariant's text in
  `CLAUDE.md` moves from one pinned version to one per round.
- TSE gets credit wherever its data appears, in both rounds.
- Every user-facing string exists in Portuguese and English.
- Candidates' personal identifiers never leave the pipeline. Round 2 reads the same
  allowlist of candidate columns.

The change depends on D13 (immutable versions), D14 (the order and the freeze), D15, D16
and D17 (no projections, no live results). It amends D13, because the app's pin moves
from one version to one per round. The summaries' and the Parquet files' schema does not
change.

## Order and dates

The code merges by 2026-10-23, tested on synthetic round-2 fixtures. Nothing deploys from
2026-10-24 to 2026-10-26. After TSE's files hold round 2, "Publish data" runs with round
2, and a PR pins the version. If Rio's recount lands, "Publish data" runs with round 1,
and a PR pins that version, outside the freeze.

## Non-goals

- No live results on the night (D17). The data publishes once TSE's open data holds the
  round.
- No projection, and no estimate of where any candidate's voters went (D16, D17).
- No automatic check of TSE's files for a recount. Luiz watches the official results.
- No change to any round-1 address, and no change to the round-1 results that a page
  shows.
- No round-2 search. The search index comes from the round-1 version, so a candidacy in
  the search shows TSE's round-1 outcome, such as "2º turno", after the runoff too.
  Search keeps leading to round-1 pages and to candidate pages, which carry both rounds.
- No swing map between the rounds. Issue 38 holds it, after issue 31.
- No comparison with 2022 (D17).
- No change to the summaries' or the Parquet files' schema.

## Impact

- `pipeline/`: the round-2 configuration, synthetic round-2 fixtures, and tests.
- `.github/workflows/publish-data.yml`: a round input for the data target.
- `web/`: a pin per round in `src/data-version.ts`, `prepare-data.ts` and `.data/` per
  round, round-2 routes in both languages, the round switch, round-aware headlines,
  cards, maps and candidate pages, round-2 drill-down views, round-2 web fixtures, and
  new messages.
- `docs/decisions.md`: D13 moves to one pinned version per round, and D14 records this
  change's order and its dates.
- `CLAUDE.md`: the run-time invariant names one pinned version per round.
- `README.md`: the runoff milestone moves from the night of 2026-10-25 to after TSE's
  open data holds round 2.
