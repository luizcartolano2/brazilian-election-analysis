## Context

See `proposal.md` for the motivation, and the delta spec for the requirements.

A finalist's page has a round-1 section and, once round 2 is pinned, a round-2 section
above it. Each section draws a share map with `RaceMap`, from a source of kind `file`. The
source names the race's values file for its area and round, `<area>/<cargo>-votos`, with
its SHA-256. `RaceMap` fetches the file, checks it, and builds the candidate's map with
`shareMap()`. Each values file holds candidates' votes and the valid votes, by
municipality, keyed by the IBGE and TSE codes. Each map also fetches, checks and parses
its boundary file on its own, when it nears the viewport.

So the page already loads both rounds' values files for the race. The page size gate reads
each values file address from the HTML once, whatever the number of maps that name it.

A round-2 values file takes its columns from round 1's records. `colorRaceOf` keeps round
1's candidates that are also in round 2, and `raceUnits` keeps those whose round-1
destination is valid. The column then sums only round 2's votes of type candidate. So a
finalist whose round-2 votes TSE annuls sub judice keeps a column of zeros.

The build knows whether each pinned round is synthetic, from its manifest's `sintetico`
flag, through `getRoundSource(round).synthetic`. A published pin also needs
`fontes_tse === true`, which `verifyManifest` checks. Every fixture manifest has
`fontes_tse: false`, so the fixture build cannot use that flag to tell real data from
synthetic data. The synthetic round 2 of the fixtures keeps each finalist's round-1 votes
at every station and turns every other vote into a null vote. Its head-to-head shares
therefore equal round 1's everywhere.

The maps use ColorBrewer's blues and oranges for the two candidates, and its greens for a
share's six steps.

## Goals / Non-Goals

**Goals:**

- The swing map reads no file beyond the two that the page already loads, and each
  boundary or values file is fetched, checked and parsed once per page. A later page in
  the visit reuses it while the cache keeps it.
- The swing map fails closed: no partial colors, no partial list, and no swing built on a
  finalist whose round-2 votes are not valid.
- The frame alone carries everything a cropped screenshot needs.
- The drawn map runs in the browser tests of every PR, before the round-2 pin.

**Non-Goals:**

- No change to the values files.
- No new map kind on any page other than a finalist's.

## Decisions

### 1. The swing comes from the two rounds' values files

The browser joins the round-1 and round-2 files on the TSE municipality code. For each
municipality, it reads both finalists' votes in each round, and computes each round's
head-to-head share and their difference, rounded to one decimal.

Alternative: write a swing values file per race and area in `prepare-data.ts`. That adds a
third file to the page's weight, and a third copy of each municipality's name, for numbers
that the two existing files already hold.

Alternative: render the swing into the HTML. That puts every municipality's values back
into the page, which `shrink-page-payloads` took out.

### 2. One cache of checked files for the visit

A module-level cache in `race-map.tsx` holds the checked, parsed boundary and values files.
Its rules:

- The key is the address and the expected SHA-256 together, so a caller with another pin
  never reads a file that someone else's pin checked.
- An entry holds the promise of a load. A load that fails removes its entry, so no failure
  stays in the cache, and the next map or page requests the file again.
- A retry removes the entries of the map's own files, two for a swing map, and fetches each
  with `cache: 'reload'`.
- The cache keeps the six most recently used entries. A finalist's page uses three: the
  two rounds' values files and the area's boundary file. An entry that the cache drops is
  fetched and checked again by the next page that needs it.
- When one file answers 404 and the other fails its check, the map offers to reload the
  page, because a reload fixes both.
- Each map keeps its own failure state and its own retry. A retry that succeeds in one map
  fills the cache, so another map's retry then succeeds at once.

The module scope outlives the page, because `AppLink` navigates on the client. A visitor
who goes from one finalist's page to the other then reuses both values files and the
boundary file, which are immutable and already checked. The amended rule in "Maps use only
checked data" counts that reuse as a request. The limit keeps the memory of a long visit
bounded, because each values file holds every municipality of a race.

Alternative: a cache that the candidate page owns, which ends with the page. It saves the
same work within one page, but the next finalist's page hashes and parses the same files
again.

### 3. The build compares the two rounds' municipalities

For each race with values files in both rounds for an area, `prepare-data.ts` compares the
two files' municipality codes. If they differ, the build prints the codes that differ, and
that race and area get no swing map. The share maps and every other page build as usual.

Alternative: fail the build. A difference in the list of places is not a sum that fails to
reconcile within a round. Failing would block the round-2 pin, for every page, over a join
that only the swing map needs.

### 4. Who gets a swing map

The candidate page renders the swing section when all of these hold at build time:

1. Round 2 is in the build, and neither round's manifest has `sintetico: true`.
2. The candidate is a finalist, and both finalists' destination is `Válido` in both
   rounds' summaries for the race and area.
3. Both rounds' values files hold both finalists' columns, and decision 3 found the same
   municipalities in both.
4. The area has a map, so it has more than one municipality.

Rule 2 reads the summaries, as the share maps do, because a round-2 file keeps a column of
zeros for a finalist whose round-2 votes are under appeal. Without it, the other
finalist's swing would read as a large gain in every municipality.

Rule 1 reads `sintetico` rather than `fontes_tse`. A published pin needs TSE's sources
anyway, and every fixture manifest says `fontes_tse: false`, so that flag would keep the
map off every fixture build.

### 5. Steps and palette

Seven steps on the swing rounded to one decimal, by its absolute value: under 1 point,
1 to under 3, 3 to under 6, and 6 or more, on each side of zero. The rule on the absolute
value puts +1.0 and −1.0 in mirrored steps, which a half-open floor on the signed value
would not.

The steps are fixed before round 2's data exists, so nobody can tune the scale to the
result. They are narrower than a share map's 10 points because a swing is a change between
two rounds of the same two candidates, not a level. They are not fitted to any past runoff.
A check on 2022's files, which the project does not publish, can test them before the pin.

The palette is ColorBrewer's seven-class PRGn: greens for the page's finalist's gain,
purples for its loss, and its `#f7f7f7` middle. A gain reads in the same hue as a high
share on the share map above it. Blue and orange belong to the candidates.

A municipality with no swing takes a hatched fill, gray lines on white, defined next to the
tie pattern. A flat no-data color sits too close to `#f7f7f7`.

Alternative: PuOr or RdBu, which reuse a candidate's orange or blue. BrBG, whose teal sits
close to the candidate blue for the common color-vision deficiencies, and whose brown sits
close to the dark orange.

### 6. The frame, the details and the list

The frame carries:

- The title: the finalist, the race, the area, and the change from round 1 to round 2.
- The subtitle: the share of the two finalists' votes, in percentage points.
- The legend: the seven signed steps and the hatched no-data swatch.
- The note, in three sentences. The map compares two official counts of the two
  finalists' votes. A change mixes differences in turnout, the round-1 votes of the
  eliminated candidates, and votes that changed between the finalists, and TSE's files
  cannot separate them. It does not show where any voter's vote went.
- The TSE and IBGE credits, as on every map.

The details of a municipality show its name, the finalist's share of the two finalists'
votes in each round, and the swing. A click opens the municipality's round-2 view, because
the swing map belongs to the round-2 section.

The list reuses the share map's list: a folded `<details>` whose summary names the count,
rows grouped by state on a President finalist's page, and the same filter. Its column
headers are the municipality, the share of the two finalists' votes in round 1 and in
round 2, and the swing with its sign. It sorts by name or by swing, from the largest gain.
A municipality with no swing says that the finalists had no votes in that round, and sorts
last.

No label says "share" alone, because the share map on the same page means a share of the
valid votes. A test searches the section's heading, frame, details and list, in both
languages, for words of transfer, migration and a named candidate's voters.

### 7. Testing the drawn map before the runoff

`ELEICOES_FIXTURE_SWING=1` lifts rule 1 of decision 4 over a synthetic round 2. It works in
fixtures mode only, and `prepare-data.ts` refuses it otherwise, as it refuses
`ELEICOES_FIXTURE_ROUNDS`. CI's main fixture build sets it, so the browser tests draw the
swing map on every PR. The synthetic round 2 gives a swing of zero everywhere, so the
browser tests check the map's presence, frame, legend, details, list, mirror and words, and
the page's weight. The unit tests carry the arithmetic, on in-memory files with real
differences: the swing, the mirror, the edges, the no-data case and the join.

A unit test of the rules in decision 4 checks that a synthetic round 2 gets no swing map
without the switch. The round-1-only build of CI checks that no round 2 means no swing map.

Alternative: change the synthetic round 2 so that the finalists' votes move by a fixed
rule. Every round-2 test reads that data, and its swings would still mean nothing.

Alternative: mount the swing source in a component test with mocked files. It needs mocks
for `fetch`, `crypto.subtle` and the viewport observer, and it misses the page around the
map.

## Risks / Trade-offs

- [A reader still takes the map as a transfer of voters] → The frame states what the map
  compares, what a change mixes, and what it does not show. The labels name their
  denominator, the list attributes nothing, and the two finalists' maps mirror each other.
  No frame can prevent every reading.
- [TSE lists different municipalities in the two rounds] → That race and area get no swing
  map, by decision 3, and the pin PR's build log prints the codes.
- [A finalist's votes go under appeal after the runoff] → Neither finalist's page shows a
  swing map, by decision 4, until TSE's summaries list both as valid again.
- [A third map on a finalist's page costs a phone more work] → The cache fetches, hashes
  and parses each file once. Each map still scales and draws its own paths. On a
  President finalist's page, that is three drawings of about 5,570 municipalities, each
  when its map nears the viewport.
- [The steps do not fit the real swings] → They are fixed before the data, by decision 5,
  and the steps change only through a new OpenSpec change.

## Migration Plan

One web PR, which also sets the fixture switch in `.github/workflows/ci.yml`. It merges
whenever it is ready, but not from 2026-10-24 to 2026-10-26, by D14. The guard keeps the
map off the site until round 2 is pinned, so the pin PR changes no code for it. The section
adds no values file, but it adds HTML. The fixture build with the swing switch renders
it, so the PR records Lula's page and the largest finalist's page on that build, before
and after, against the gate. The pin PR's checklist on issue 36 measures the same pages
again on the real data. Reverting the PR removes the section.
