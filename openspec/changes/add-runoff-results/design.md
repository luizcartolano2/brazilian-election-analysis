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
`"turno"`, the build keeps its single round, and a recount of round 1 leaves round 2
alone. The cost is a second pin, which is one more line in `src/data-version.ts`.

### 2. The pipeline's round 2

`ROUNDS[2]` holds `president=6258`, `state=6260` and no municipal election. The build's
states come from the round's President municipality list, and each state's races from
its round-2 vote rows, as today. So the seven Governor runoffs, or six if Rio's is
cancelled, need no list in code.

`publish-data.yml` gains a `round` input, `1` or `2`, for the data target only. The build
job passes it to `eleicoes build --round`.

The round-2 fixtures come from a new script, `tests/fixtures/build_runoff_fixtures.py`. It
derives them from the round-1 fixtures: it keeps the two most voted President candidates
in each fixture station and, in one fixture state, the two most voted Governor
candidates. It splits each station's valid votes between them with a fixed rule, writes
`NR_TURNO` 2, and writes TSE's results-site JSON for 6258 and 6260 to match. The numbers
are synthetic and say so in the fixture README. After TSE publishes round 2, a task recuts
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
`.data/` moves its round files under `.data/rounds/<round>/`: the summaries, the map values
and `source.json`. `municipios.json` stays shared, because the municipality list does not
change between rounds. The data accessors in `src/lib/data.ts` take a round, which
defaults to 1.

The drill-down configuration carries a data base for each pinned round, and
`src/lib/drilldown/files.ts` builds the paths of the address's round.

### 4. The round-2 routes

Each round-1 route gets a round-2 twin under `app/(pt)/2026/segundo-turno/` and
`app/en/2026/segundo-turno/`, and each twin renders the same view with `round={2}`. When
round 2 is not pinned, the dynamic twins' `generateStaticParams()` return no entry, and
`/2026/segundo-turno/` renders the waiting page.

Next.js's static export can reject an empty `generateStaticParams()` for a dynamic route.
The first task finds out. If it does reject one, the round-2 dynamic routes stay out of
the build until the pin PR adds them, behind a check that fails the build when round 2 is
pinned and they are missing.

### 5. The round switch and the link from round 1

Each page passes its round-1 and round-2 addresses to `PageShell`, with `null` where the
other round has no such page. The header's chip becomes two links, `1º turno · 4 de
outubro` and `2º turno · 25 de outubro`, with the current round marked by
`aria-current`. A missing counterpart leads to that round's Brazil page.

The round-1 Brazil page renders a card under its cards. Before round 2 is pinned, the
card states the runoff's date. After, it shows the round-2 headline and links to it.

### 6. Headlines, cards and colors in round 2

`raceHeadline()` and `candidateHeadline()` take the round. In round 2, the elected form
uses new messages, "{names} vence no 2º turno" and "Vence no 2º turno". A round-2 card
states no runoff date, because round 2 has no further round.

The ranks come from round 1: `candidateRanks(round2Race, round1ColorRace)`, where the color
race is Brazil's round-1 President race or the state's round-1 Governor race. The round-2
map values use the same color race, so the maps and the cards agree.

### 7. A finalist's page

The candidate page reads the candidacy in round 2 when round 2 is pinned and the
candidacy appears in it. It then renders a round-2 section first: its headline, stats,
share map and largest municipalities, then the round-1 content as today. The page's
headline is the round-2 one.

### 8. The swing map, later

The swing map compares a finalist's share in each municipality between the two pinned
versions, from the two `-votos.json` files that the build already writes. It uses a
diverging palette that is neither of the candidate colors, centered on zero, with its
own legend. It ships after round 2 is live, as its own PR, so it never delays the
runoff results.

## Risks / Trade-offs

- [The synthetic fixtures differ from TSE's real round-2 files] → The pipeline reads the
  same files with the same columns, filtered on `NR_TURNO`. The pin PR builds against the
  real version first, and the recut of the fixtures follows. A difference fails that
  build before anything deploys.
- [TSE publishes later than five days] → Nothing breaks. The waiting page stays up until
  the pin.
- [Rio's ruling arrives after the runoff] → Round 1 republishes alone. If TSE also changes
  round 2, round 2 republishes alone too.
- [A finalist's page grows past the size limit] → Lula's page is 1,084,168 bytes today. A
  round-2 share map adds about the same again, and the swing map more. The page size gate
  fails the build first. Issue 31, which moves map values out of the page payloads, is
  the fix if that happens, and the swing map PR measures it before it merges.
- [The freeze] → The code PRs merge by 2026-10-23. The pin PR merges after 2026-10-26.

## Migration Plan

1. Pipeline PR: round 2's configuration, the synthetic fixtures, and the publish input.
2. Web data PR: the pin per round, `.data/` per round, the round-2 web fixtures, and the
   drill-down per round. Round 1 renders exactly as today.
3. Web pages PR: the round-2 routes, the waiting page, the switch, the link from round 1,
   the headlines, maps and candidate sections.
4. After TSE publishes: "Publish data" with round 2, then the pin PR, then the live checks.
5. Later: the swing map PR.

Each PR reverts on its own. Before the pin, round 2 shows only the waiting page, so PRs 1
to 3 are safe to deploy before the freeze.
