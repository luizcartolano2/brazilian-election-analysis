## Why

After the runoff, a finalist's page shows each round's share map, one above the other. A
reader who wants to know where the finalist did better or worse in round 2 must compare
two maps by eye, municipality by municipality. Issue 38 asks for one map of that change.

The map is the chart most likely to be read as a transfer of voters, which no public file
supports. Issue 38 left three decisions open: the metric, the framing and the size. This
change settles them.

## What Changes

- Each round-2 finalist's page gains a swing map in its round-2 section, below the
  round-2 share map. It colors each municipality by the change in the finalist's
  head-to-head share, in percentage points, in seven fixed steps centered on zero.
- The head-to-head share is the finalist's votes over the two finalists' combined votes.
  The change is its round-2 value minus its round-1 value. The two finalists' maps mirror
  each other.
- The browser builds the swing from the two values files that the page already loads for
  its two share maps, after the same SHA-256 checks. The map adds no file, so the page
  size gate counts the same values files as today, plus the section's HTML. Its PR records
  the largest finalist's page against the 2.5 MB gate.
- One cache of checked files serves the maps of a visit. Each boundary and values file is
  fetched, checked and parsed once per page, and a later page reuses it while it is among
  the six most recently used. A failure never stays in the cache.
- The map's frame names the finalist, the race, the area and both rounds, and carries the
  TSE and IBGE credits. It states that the map compares two official counts of the
  finalists' votes, that a change mixes turnout, the eliminated candidates' round-1 votes
  and votes that changed between the finalists, which TSE's files cannot separate, and
  that the map does not show where any voter's vote went.
- Every label of a head-to-head share names its denominator, the two finalists' votes.
  The palette uses neither candidate color.
- A folded list of municipalities follows the map, with each municipality's head-to-head
  share in each round and the change. A municipality's details show the same, and a click
  opens its round-2 view.
- The swing map appears only when round 2 is in the build, neither round is synthetic, and
  both finalists' votes are valid in both rounds. A finalist whose round-2 votes go under
  appeal would otherwise keep a column of zeros.
- The build compares the two rounds' municipalities for each race and area. If they
  differ, that race and area get no swing map, and the build prints the codes.
- A fixtures-only switch, `ELEICOES_FIXTURE_SWING`, draws the swing map over the synthetic
  round 2, so the browser tests run on every PR.
- The new text ships in Portuguese and English.

Luiz chose the metric on 2026-10-13, after a comparison on invented municipalities. The
change in the share of valid votes makes both finalists gain almost everywhere, by about
the eliminated candidates' share, which reads as a transfer of voters. The change in votes
follows each municipality's size and turnout more than the finalist's standing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `results-maps`: a finalist's round-2 section gains a swing map with its folded list, its
  frame states what it compares, and it appears only on real data with valid finalists in
  both rounds. A map can reuse a file that passed the same check earlier in the visit.

## Invariants

This change touches these invariants in `CLAUDE.md`, and it keeps each one as follows:

- An estimate is never a count. The swing is the difference of two shares, each computed
  from official counts, so it shows no estimate. Its frame says what it compares and what it does not show, and no
  text or chart states where any voter's vote went.
- No integrity claims. The map scores nothing as suspicious and projects nothing. It shows
  only after the runoff's results are pinned.
- The app reads only pinned data at run time. The swing comes from the two values files
  that the build derives from the pinned versions, each checked against its SHA-256.
- TSE gets credit wherever its data appears. The frame carries the TSE and IBGE credits.
- Every user-facing string exists in Portuguese and English. The frame, the legend, the
  details, the list and the messages ship in both.

The change depends on D16 and D17: it states no voter movement and no projection. D14
gains its timing. It keeps D2, because the swing, like a candidate's share by
municipality, needs JavaScript, and the page's other results stay in the HTML.

## Non-goals

- No swing on the race, state or Brazil pages. The map belongs to a finalist's page.
- No swing table by state.
- No estimate of where any candidate's voters went between the rounds, in any form.
- No swing for a race without a runoff, or for a candidate who was not a finalist.
- No change to the pipeline, the data versions or the Worker.

## Impact

- `web/src/lib/maps.ts`: the swing rows built from two rounds' votes, and their steps.
- `web/src/lib/map-colors.ts`: the diverging palette and the hatched no-data fill.
- `web/src/components/race-map.tsx`: the cache of checked files, a map source that reads
  two of them, the swing frame, details and list.
- `web/src/views/map-section.tsx` and `candidate-views.tsx`: the swing section in a
  finalist's round-2 section, behind its guard.
- `web/scripts/prepare-data.ts`: the comparison of the two rounds' municipalities, and the
  fixtures-only switch.
- `.github/workflows/ci.yml`: the switch on the main fixture build.
- `web/messages/pt.json` and `en.json`: the new messages.
- `web/README.md`: the swing map, its guard and the cache.
- `docs/decisions.md`: D14 records this change's timing.
