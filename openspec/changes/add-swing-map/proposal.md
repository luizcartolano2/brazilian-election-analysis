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
  head-to-head share, in percentage points.
- The head-to-head share is the finalist's votes over the two finalists' combined votes.
  The change is its round-2 value minus its round-1 value. Eliminated candidates' votes
  enter neither share, so the two finalists' maps mirror each other.
- The browser builds the swing from the two values files that the page already loads for
  its two share maps, after the same SHA-256 checks. The map adds no file, so the page
  size gate counts the same bytes as today.
- The map's frame states that it compares two official counts of the two finalists'
  votes, names both rounds, and carries the TSE and IBGE credits, so a cropped screenshot
  keeps all of them. A diverging palette centered on zero uses neither candidate color.
- A folded list of municipalities follows the map, with each municipality's head-to-head
  share in each round and the change. It loads with the map, as the share map's list does.
- The swing map appears only when both pinned rounds come from TSE's real files. On the
  synthetic round 2 of the test builds, whose head-to-head shares equal round 1's
  everywhere, the page shows no swing map.
- A municipality where the two finalists had no votes in a round has no swing. It takes
  the map's no-data fill, and its row in the list says so.
- The new text ships in Portuguese and English.

Luiz chose the metric on 2026-10-13, after a comparison on invented municipalities. The
change in the share of valid votes makes both finalists gain almost everywhere, by about
the eliminated candidates' share, which reads as a transfer of voters. The change in votes
follows each municipality's size and turnout more than the finalist's standing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `results-maps`: a finalist's round-2 section gains a swing map with its folded list,
  its frame states what it compares, and it appears only on real data from both rounds.

## Invariants

This change touches these invariants in `CLAUDE.md`, and it keeps each one as follows:

- An estimate is never a count. The swing is a difference of two official counts, so it
  shows no estimate. Its frame says that it compares counts, and no text or chart states
  where any voter's vote went.
- No integrity claims. The map scores nothing as suspicious and projects nothing. It shows
  only after the runoff's results are pinned.
- The app reads only pinned data at run time. The swing comes from the two values files
  that the build derives from the pinned versions, each checked against its SHA-256.
- TSE gets credit wherever its data appears. The frame carries the TSE and IBGE credits.
- Every user-facing string exists in Portuguese and English. The frame, the legend, the
  list and the messages ship in both.

The change depends on D16 and D17: it states no voter movement and no projection. D14
gains its timing. It keeps D2, because the swing, like a candidate's share by municipality, needs JavaScript, and the
page's other results stay in the HTML.

## Non-goals

- No swing on the race, state or Brazil pages. The map belongs to a finalist's page.
- No swing table by state.
- No estimate of where any candidate's voters went between the rounds, in any form.
- No swing for a race without a runoff, or for a candidate who was not a finalist.
- No change to the pipeline, the data versions or the Worker.

## Impact

- `web/src/lib/maps.ts`: a swing map built from two rounds' votes, with its steps.
- `web/src/lib/map-colors.ts`: the diverging palette.
- `web/src/components/race-map.tsx`: a map source that reads two checked files, its
  legend, and its list with both rounds' shares.
- `web/src/views/map-section.tsx` and `candidate-views.tsx`: the swing section in a
  finalist's round-2 section, behind the guard on real data.
- `web/messages/pt.json` and `en.json`: the new messages.
- `web/README.md`: the swing map and its guard.
- `docs/decisions.md`: D14 records this change's timing.
