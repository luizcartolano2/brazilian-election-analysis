## Why

The heaviest pages carry their map's values inside the page. Lula's candidate page is
1,085,589 bytes: its municipality list is 755 kB of HTML, and the props that rebuild that
list in the browser add 317 kB. The Brazil page is 395,608 bytes, and 358,597 of them are
the President map's props. Round 2 adds a second share map to each finalist's page, which
brings Lula's page to an estimated 2.17 MB, under the 2.5 MB gate with little room left,
and the swing map in issue 38 cannot fit at all.

The build also stores each page's navigation data three times. Every page has an
`index.txt`, an identical `__next._full.txt`, and a `__PAGE__` segment file of nearly the
same size. A test of client navigation on the static export showed that the app requests
only `index.txt`, because its links never prefetch. Together these files are 191 MB of the
347 MB that one production build stores on Vercel.

Issue 31 records the measurements. This change lands before the freeze on 2026-10-24, so
that the round-2 pin builds well under the gate (D14).

## What Changes

- The Brazil page's President map loads its values from a file, instead of from the
  page. The page carries the file's address and SHA-256, and the browser checks the file
  before it draws. The Brazil page has no list of municipalities today, so nothing else
  changes on it.
- Every candidate page's share map loads its values from one file per race, area and
  round, which every candidate of that race shares in both languages. The browser builds
  the candidate's share map and its list of municipalities from that file, after checking
  its SHA-256.
- A candidate page's list of municipalities no longer ships in its HTML. It appears with
  the map, from the same file. Without JavaScript, the page says that the map and its list
  need JavaScript. The page's HTML keeps the candidate's votes, share, outcome and place,
  the six largest municipalities and, for President, the share in each state.
- State and race pages keep their lists in the HTML, as today, because a race page's list
  is the text equivalent that a visitor without JavaScript reads.
- If the browser cannot load or check a values file, the map shows neither colors nor a
  list, says that it failed to load them, and offers a retry.
- The build deletes the navigation files that the app never requests, after `next build`
  and before the page size gate. It keeps each page's `index.txt`.
- The new text ships in Portuguese and English.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `results-maps`: the Brazil map and the share maps read their values from checked files,
  a candidate page's list comes with its map instead of in its HTML, and a values file
  that fails to load shows no partial map.

## Invariants

This change touches these invariants in `CLAUDE.md`, and it keeps each one as follows:

- The app reads only pinned data at run time. Each values file is derived by the build
  from the pinned version, and served from the app's own origin, as the search index is.
  The browser also checks its SHA-256, as it does for the boundaries.
- TSE gets credit wherever its data appears. The map's frame keeps its TSE and IBGE
  credits, whether its values come from the page or from a file.
- Every user-facing string exists in Portuguese and English. The new messages, for the
  values that fail to load and for the list that needs JavaScript, ship in both.
- An estimate is never a count. The change shows no estimate.

The change depends on D10 (a static export) and D14 (the freeze). It keeps D2 (indexed):
search engines still read every state and race list, and each candidate's six largest
municipalities.

## Non-goals

- No change to a state or race page's list, its map, or its HTML.
- No change to the data versions, the pipeline or the Worker.
- No change to the deputy race pages' full results, which are their own size question.
- No new map. The swing map stays in issue 38, which this change unblocks.
- No change to the 2.5 MB page size gate.

## Impact

- `web/scripts/prepare-data.ts` and `web/scripts/map-data.ts`: write the values files under
  `public/`, named by their content, and record each one's address and SHA-256.
- `web/src/components/race-map.tsx`: a map that loads its values from a checked file, its
  loading and failure states, and its list rendered from those values.
- `web/src/views/map-section.tsx`, `area-views.tsx` and `candidate-views.tsx`: pass the
  file instead of the values for the Brazil map and the share maps.
- A step after `next build` that deletes the unused navigation files, in `package.json`.
- `web/vercel.json`: the values files are cached for good, as the search index is.
- `web/messages/pt.json` and `en.json`: the new messages.
- `web/README.md`: the values files and the pruned navigation files.
