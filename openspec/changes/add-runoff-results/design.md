## Context

See `proposal.md` for the motivation, and the four delta specs for the requirements.

The pipeline already builds one round per run. `RoundConfig` names a round's election
codes, every TSE file is filtered on `NR_TURNO`, and a state's races come from its vote
rows. Each version writes its files under `2026/t<round>/`, and its manifest records
`"turno"`. Round 2 needs a configuration entry, not a new mechanism.

The app is the round-1 app. `ROUND = 1` sits in `src/lib/elections.ts`, the manifest check
rejects any other round, `src/lib/drilldown/files.ts` and `scripts/map-data.ts` build
`2026/t1/` paths, and `.data/` holds one round. Every page reads that one round.

TSE's real round-2 files do not exist until after 2026-10-25. The round-1 fixtures are cut
from real files, so the round-2 fixtures must be synthetic until then.

## Goals / Non-Goals

**Goals:**

- Round 2 lands in code before the freeze, and goes live with one publish and one pin
  PR once TSE's files hold it.
- Round 1 can be republished alone, for Rio, at any time.
- Every round-2 page reuses the round-1 views, with the round as a parameter.

**Non-Goals:**

- No change to the summaries' or the Parquet files' schema. A round-2 summary has the
  same shape as a round-1 summary.
- No new client-side data loading, except the drill-down views of round 2, which work as
  those of round 1.

## Decisions

### 1. One version per round

A publish builds one round, and the app pins one version for each round.

Alternative: one version holding both rounds, under `2026/t1/` and `2026/t2/`. That needs
a multi-round build, a manifest with a list of rounds, and a rebuild of round 2 whenever
Rio's recount changes round 1. With one version per round, the manifest keeps its
`"turno"`, the build keeps its single round, and a recount of round 1 leaves the data of
round 2 untouched. The cost is a second pin, which is one more line in
`src/data-version.ts`, and a check that the two pins agree.

The check runs in `prepare-data.ts` when round 2 is pinned. Each round-2 race must hold
exactly the candidates that the round-1 version marks for a runoff in that race, and
each race marked for a runoff must appear in round 2. So a recount that changes who
reached round 2, such as a cancelled runoff in Rio, fails the build until both pins
agree with TSE.

D13 said that the app pins one data version. This change amends D13 to one version per
round, and `CLAUDE.md`'s run-time invariant with it.

### 2. The pipeline's round 2

`ROUNDS[2]` holds `president=6258`, `state=6260` and no municipal election. The build's
states come from the round's President municipality list, and each state's races from
its round-2 vote rows, as today. So the seven Governor runoffs, or six if Rio's is
cancelled, need no list in code.

`publish-data.yml` gains a `round` input, `1` or `2`, for the data target only. The build
job passes it to `eleicoes build --round`.

The round-2 fixtures come from a new script, `tests/fixtures/build_runoff_fixtures.py`. It
derives them from the round-1 fixtures, and adds them to the same files, as TSE does. The
finalists are the candidates that round 1 sends to the runoff: the President finalists,
and the Governor finalists of Acre, the one fixture state with a Governor runoff. Each
finalist keeps its round-1 votes at each station, and every other vote becomes a null
vote. The script writes TSE's results-site JSON for 6258 and 6260 to match. The rule
copies round 1 mechanically, so the numbers never forecast the runoff, and the fixture
README says that they are synthetic. After TSE publishes round 2, a task recuts
the fixtures from the real files.

### 3. The app's pins and data

```ts
// Before
export const DATA_VERSION = { name: '20261007-67d59ff-37656362427', manifestSha256: '…', workerUrl }

// After
export const DATA_VERSIONS = {
  1: { name: '20261007-67d59ff-37656362427', manifestSha256: '…' },
  2: null, // set by the pin PR after TSE publishes round 2
} as const
```

`prepare-data.ts` reads each pinned version and checks its manifest's year and round.
`.data/` moves its round files under `.data/rounds/<round>/`: the summaries, the map values,
`municipios.json` and `source.json`. Each round keeps its own `municipios.json`, because
each version verifies its own list, and a round-1 recount must not change what round 2
reads. The data accessors in `src/lib/data.ts` take a round, which defaults to 1.

The drill-down configuration carries a data base for each pinned round, and
`src/lib/drilldown/files.ts` builds the paths of the address's round. A race's TSE
election code comes from the round: `RACES` in `src/lib/elections.ts` gains the round-2
code of President (6258) and Governor (6260). The station link to TSE in
`drilldown.tsx` and `drilldown/model.ts` reads the code of the view's round.

### 4. The round-2 routes

Each round-1 area, race and drill-down route gets a round-2 twin under
`app/(pt)/2026/segundo-turno/` and `app/en/2026/segundo-turno/`, and each twin renders
the same view with `round={2}`. The candidate and sources routes get no twin.

A spike on 2026-10-09 showed that the static export rejects an empty
`generateStaticParams()`. Next 16 stops the build with "returned an empty array from
`generateStaticParams()`. With `output: export`, at least one route must be generated."

So the twins never return an empty list. Before the pin, the state twin lists every
state and abroad, and the race twin lists each state's President race, because round 2
holds President everywhere. Each of these pages, the Brazil page and the drill-down
twins render the waiting content. After the pin, the lists come from the round-2
summaries, which hold the same addresses plus the Governor runoffs. So no round-2
address disappears at the pin. The check in decision 1 fails the build if the round-2
version lacks an area.

Alternative: one placeholder parameter that renders the waiting content. It writes an
address that never holds a result. Alternative: the pin PR adds the dynamic twins,
behind a check that fails the build when round 2 is pinned and they are missing. Their
code then lands after the freeze, in a PR that also moves data, and the production build
never runs them before the night.

### 5. The round switch and the link from round 1

Each page passes its round-1 and round-2 addresses to `PageShell`, with `null` where the
other round has no such page. The header's chip becomes two links, `1º turno · 4 de
outubro` and `2º turno · 25 de outubro`, with the current round marked by
`aria-current`. A missing counterpart leads to the same area in that round, else to that
round's Brazil page. So `/2026/sp/senador/` leads to `/2026/segundo-turno/sp/`.

A finalist's candidate page shows both rounds, so its two links lead to its own round
sections, and neither carries `aria-current`. The sources page serves both rounds, so its
links lead to each round's Brazil page, and neither carries `aria-current`.

The round-1 Brazil page renders a card under its candidate cards. Before round 2 is pinned, the
card states the runoff's date. After, it shows the round-2 headline and links to it.

### 6. Headlines, cards and colors in round 2

`raceHeadline()` and `candidateHeadline()` take the round. In round 2, the elected form
uses new messages, "{names} vence no 2º turno" and "Vence no 2º turno". A round-2 card
states no runoff date, because round 2 has no further round.

The ranks come from round 1: `candidateRanks(round2Race, round1ColorRace)`, where the color
race is Brazil's round-1 President race or the state's round-1 Governor race. The round-2
map values use the same color race, so the maps and the cards agree. A candidate keeps
one color across the rounds, so a reader who compares the two rounds' maps finds each
finalist in the same color.

Alternative: rank round 2 by its own result. A round-1 runner-up who wins round 2 then
swaps colors between the rounds, and the two maps contradict each other.

### 7. A finalist's page

The candidate page reads the candidacy in round 2 when round 2 is pinned and the
candidacy appears in it. It then renders a round-2 section first: its headline, stats,
share map and largest municipalities, then the round-1 content as today. A President
finalist's round-2 section also repeats the share in each state, the count of states led
and the note on the votes abroad, each linking to round-2 pages. An area with one municipality gets no map and no list, as in round 1. The page's
headline is the round-2 one.

### 8. The swing map is a follow-up

The swing map between the rounds is out of this change. Its size, its framing and its
metric need their own decisions, and issue 31 comes first. Issue 38 records them.

## Risks / Trade-offs

- [The synthetic fixtures differ from TSE's real round-2 files] → The pipeline reads the
  same files with the same columns, filtered on `NR_TURNO`. The pin PR builds against the
  real version first, and the recut of the fixtures follows. A difference fails that
  build before anything deploys.
- [TSE publishes later than five days] → Nothing breaks. The waiting content stays up until
  the pin.
- [Rio's ruling arrives after the runoff] → Round 1 republishes alone. If TSE also changes
  round 2, round 2 republishes alone too. The check in decision 1 fails the build while
  the two pins disagree.
- [Rio's ruling arrives during the freeze] → Nothing deploys until 2026-10-27. The site
  keeps TSE's previous round-1 count, which was official when it published. The round-1
  republish and its pin PR follow the freeze.
- [A finalist's page grows past the size limit] → Lula's page is 1,084,168 bytes today. A
  round-2 share map adds about the same again. The page size gate fails the build first.
  Issue 31, which moves map values out of the page payloads, is the fix if that happens.
- [The freeze] → The code PRs merge by 2026-10-23. The pin PR merges after 2026-10-26.

## Migration Plan

1. Pipeline PR: round 2's configuration, the synthetic fixtures, and the publish input.
2. Web data PR: the pin per round, `.data/` per round, the round-2 web fixtures, and the
   drill-down per round. Round 1 renders exactly as today.
3. Web pages PR: the round-2 routes, the waiting content, the switch, the link from round
   1, the headlines, maps and candidate sections.
4. After TSE publishes: "Publish data" with round 2, then the pin PR, then the live checks.

Each PR reverts on its own. Before the pin, every round-2 page shows only the waiting
content, so PRs 1 to 3 are safe to deploy before the freeze.
