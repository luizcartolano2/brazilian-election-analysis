## Context

See `proposal.md` for the motivation, and the delta spec for the requirements.

A finalist's page has a round-1 section and, once round 2 is pinned, a round-2 section
above it. Each section draws a share map with `RaceMap`, from a source of kind `file`. The
source names the race's values file for its area and round, `<area>/<cargo>-votos`, with
its SHA-256. `RaceMap` fetches the file, checks it, and builds the candidate's map with
`shareMap()`. Each values file holds every candidate's votes and the valid votes, by
municipality, keyed by the IBGE and TSE codes.

So the page already loads both rounds' values files for the race. The page size gate reads
each values file address from the HTML once, whatever the number of maps that name it.

The build knows whether each pinned round is synthetic, from its manifest's `sintetico`
flag, through `getRoundSource(round).synthetic`. The synthetic round 2 of the test builds
keeps each finalist's round-1 votes at every station and turns every other vote into a
null vote. Its head-to-head shares therefore equal round 1's everywhere.

The maps use ColorBrewer's blues and oranges for the two candidates, and its greens for a
share's six steps.

## Goals / Non-Goals

**Goals:**

- The swing map reads no file beyond the two that the page already loads, and each file
  is fetched and checked once per page.
- The swing map fails closed: no partial colors and no partial list.
- The frame alone carries everything a cropped screenshot needs.

**Non-Goals:**

- No change to the values files or to `prepare-data.ts` beyond one check.
- No new map kind on any page other than a finalist's.

## Decisions

### 1. The swing comes from the two rounds' values files

The browser joins the round-1 and round-2 files on the TSE municipality code. For each
municipality, it reads both finalists' votes in each round, and computes each round's
head-to-head share and their difference.

Both share maps on the page already request those two files, with the same addresses. A
module-level cache in `race-map.tsx` keeps one promise per address for the checked, parsed
file. The three maps of a finalist's page then fetch each file once, hash it once and
parse it once. A retry clears that address's entry before it fetches with
`cache: 'reload'`.

Alternative: write a swing values file per race and area in `prepare-data.ts`. That adds a
third file to the page's weight, and a third copy of each municipality's name, for numbers
that the two existing files already hold.

Alternative: render the swing into the HTML. That puts every municipality's values back
into the page, which `shrink-page-payloads` took out.

### 2. The build checks that both rounds list the same municipalities

`prepare-data.ts` fails the build when a race has values files in both rounds for one area,
and the two files list different municipalities. The browser can then treat a municipality
present in one file only as impossible, and the swing never silently skips a place.

### 3. Who gets a swing map

The candidate page renders the swing section when all of these hold at build time:

1. Round 2 is pinned, and neither pinned round is synthetic.
2. The candidate is in round 2's values file for the race and area.
3. That file holds exactly two candidates, and both are in round 1's file.
4. The area has a map, so it has more than one municipality.

The other finalist is the other number in round 2's file. A finalist whose votes are under
appeal has no column, so neither finalist's page gets a swing map, and the share maps
follow their own rules.

### 4. Steps and palette

Seven steps, in percentage points: −6 or less, −6 to −3, −3 to −1, −1 to +1, +1 to +3,
+3 to +6, and +6 or more. A swing is a change between two rounds, and most municipalities
move by a few points, so the share map's 10-point steps would color nearly every
municipality with the middle step.

The palette is ColorBrewer's seven-class PRGn: greens for a gain, purples for a loss, and
its light gray middle. A gain reads in the same hue as a high share on the share map above
it. Blue and orange belong to the candidates.

Alternative: PuOr or RdBu, which reuse a candidate's orange or blue. BrBG, whose teal sits
close to the candidate blue for the common color-vision deficiencies, and whose brown sits
close to the dark orange.

A municipality with no swing takes the existing no-data fill.

### 5. The frame

The frame carries:

- The title: the finalist, then the change from round 1 to round 2.
- The subtitle: share of the two finalists' votes, in percentage points, with the area.
- The legend: the seven steps with signed labels, and the no-data swatch.
- The note: the map compares two official counts of the two finalists' votes. The
  eliminated candidates' votes enter neither round's share. It does not show where any
  voter's vote went.
- The TSE and IBGE credits, as on every map.

The text never uses the words transfer, migration, or the voters of a named candidate,
in either language. A test searches the frame and the list for them.

### 6. The list

The list reuses the share map's list: a folded `<details>` whose summary names the count,
rows grouped by state on a President finalist's page, and the same filter. Its columns are
the municipality, the head-to-head share in round 1 and in round 2, and the swing with its
sign. It sorts by name or by swing, from the largest gain. A municipality with no swing
says that the finalists had no votes in that round, and sorts last.

### 7. Tests on data that cannot show a swing

The synthetic round 2 gives a swing of zero everywhere, and the guard hides the map on it.
So unit tests carry the map itself: the swing and its mirror on in-memory files, the steps,
the no-data case, the join, the failure and the retry. A browser test on the fixture build
checks the guard, that a synthetic round 2 shows no swing map.

The pin PR of round 2 recuts the round-2 fixtures from TSE's files, which turns the guard
off in the fixture build. A browser test then checks the drawn map, the frame, the mirror
and the list. Until that recut, it skips, and it names the recut as its reason.

## Risks / Trade-offs

- [A reader still takes the map as a transfer of voters] → The frame states what the map
  compares and what it does not show, the list attributes nothing, and the two finalists'
  maps mirror each other. No frame can prevent every reading.
- [TSE lists different municipalities in the two rounds] → The build fails, by decision 2,
  before the page deploys.
- [The browser test of the drawn map skips until the recut] → The unit tests cover the
  map, and the skip names its reason. The pin PR's checklist on issue 36 already includes
  the recut.
- [A third map on a finalist's page costs a phone more work] → It parses no file twice,
  by decision 1. Its frame and folded list add a few kilobytes of HTML.
- [A finalist's votes go under appeal after the runoff] → Neither finalist's page shows a
  swing map, by decision 3, until TSE's data lists both again.

## Migration Plan

One web PR. It merges whenever it is ready, but not from 2026-10-24 to 2026-10-26, by
D14. The guard keeps the map off the site until the round-2 pin, so the pin PR changes no
code for it. The section adds no values file, and the pin PR's checklist on issue 36
already records the largest finalist's page against the gate, swing section included.
Reverting the PR removes the section.
