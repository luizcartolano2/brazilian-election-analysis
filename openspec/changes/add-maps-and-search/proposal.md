## Why

The first release shows its numbers only in tables. A visitor cannot see where a
candidate led, and reaches a municipality only through its state's list. The first
release met D14 by shipping before the runoff. D14 now also records Luiz's target for
this change: merge by 2026-10-23, before the runoff on 2026-10-25.

A survey of the sites that publish TSE's results on 2026-10-08 shaped the scope. g1,
Poder360 and O Tempo draw municipality maps with no street basemap. Nexo goes down to
each polling place, but it loads a third party's map tiles. Every site that maps the
results colors each area by its most voted candidate, and g1 shades by margin in bins
that cut at 5 and 20 points.

## What Changes

- A search box on every page finds municipalities, cities abroad and the 18,851
  candidacies in the pinned summaries, and it ignores case and accents. It ships first,
  because it does not depend on the map boundaries.
- A new publish target stages IBGE's 2025 municipal boundaries as simplified TopoJSON.
  Each boundary build gets its own immutable path, `assets/geo/ibge-2025/<build id>/`,
  with a manifest of its source, settings and checksums. The Worker serves that path
  like the DuckDB assets.
- The build reads the municipality totals and the candidate registry that the pinned
  data version already holds, checks them against the manifest, and checks that they add
  up to each summary. The build fails on any mismatch. Each page then carries its own
  map values in its HTML, so a map needs one request at run time, for its boundaries.
- The Brazil page maps the President race by municipality. Each state page maps its
  Governor race, and each race page maps its own race.
- A map colors the most voted candidate in each municipality, shaded by margin in three
  named bins. Deputy races color the most voted federation, or the party where a party
  runs alone. Senate maps color the most voted candidate with one shade, because two
  candidates win. The top two of the race get colors, and the others share one gray.
- The maps have no basemap, no pan and no zoom. A click opens the municipality's view.
  The legend, the TSE credit and the IBGE credit sit inside each map's frame.
- Each state and race page lists its municipalities in its HTML, with the most voted and
  the margin. A visitor can sort the list by margin and filter it by name. The list is
  the text equivalent of the map, and it reads without JavaScript. On the Brazil page,
  each state links to its President race page, which holds that state's list.
- A static page for each of the 497 candidacies in the President, Governor and Senate
  races shows the candidate's results and a map of their share by municipality. That is
  994 pages across both languages.
- The sources page lists the boundaries, and `DATA_LICENSE.md` records IBGE's terms. The
  boundaries stay out of this project's own CC BY grant.
- The `CLAUDE.md` invariant on run-time reads gains the boundaries and the files that
  the build derives from the pinned version.
- All new user-facing text ships in Portuguese and English.

## Capabilities

### New Capabilities

- `results-maps`: the maps on the Brazil, state, race and candidate pages, with their
  colors, legend, credits, interaction, checks and text equivalent. It also covers the
  candidate pages that hold the share maps.
- `site-search`: the search box, its index, and where each result leads.

### Modified Capabilities

- `data-publishing`: adds the boundary asset, and lets the Worker serve and cache its
  path.
- `results-explorer`: the sources page lists the boundaries, and the app's run-time
  reads include the boundaries and the files that the build derives from the pinned
  version.

## Invariants

This change touches these invariants in `CLAUDE.md`, and it keeps each one as follows:

- An estimate is never a count. The change shows no estimate. Every color and number on
  a map is an official count or a share of one.
- No integrity claims. The maps show only the most voted, the margin and a candidate's
  share. No map shows turnout, and nothing scores or flags a municipality.
- Official numbers reconcile, or nothing publishes. The build fails when the municipality
  totals differ from the manifest or do not add up to their summary. It never adjusts a
  value to make the sums agree.
- Only GitHub Actions publishes data. The boundaries arrive through the publish
  workflow's new target, each build with its own manifest. The change needs no new data
  version.
- The app reads only its pinned data version, through the Worker. This change amends
  the invariant. The app also reads its pinned boundary build through the Worker, and
  files that the build derived from the pinned version, such as the search index, from
  its own origin.
- TSE gets credit wherever its data appears. Each map carries the TSE credit inside its
  frame, next to IBGE's.
- Every user-facing string exists in Portuguese and English.
- Never commit TSE downloads or pipeline outputs. IBGE's files are not committed either.
  Fixture boundaries cover the fixture municipalities only.
- Candidates' personal identifiers never leave the pipeline. The search index holds the
  ballot name, number, party, race, area, outcome and votes only.

The change depends on D6 (public repository), D7 (Parquet read in the browser), D9 (the
Worker), D13 (only Actions publishes), D14 and D17.

## Non-goals

- No basemap, pan or zoom.
- No circles per polling place. The coordinates stay in the data for a later change.
- No runoff data and no round switch. Those get their own change, which adds round 2 to
  the same candidate addresses.
- No turnout or abstention map.
- No candidate pages or maps for deputy candidacies. Search sends them to their race
  page.
- No map and no search entry for Fernando de Noronha's Conselheiro Distrital race. It
  has no summary and no race page, and its results stay on the municipality view.
- No search for polling places outside a municipality. The existing place search stays.
- No comparison with 2022 (D17).
- No estimates (D16).
- No change to the pipeline or to the schema between the pipeline and the app.
- No visual redesign beyond what the maps and the search box need.

## Impact

- `web/`: `d3-geo` and `topojson-client` as dependencies, and `mapshaper` as a
  development dependency of `web/geo/`, the boundary staging script's own package. A map component, the
  candidate pages, the search box, new message keys, new checks in `prepare-data.ts`,
  and a size check on the static export.
- `worker/`: the key check accepts `assets/geo/`.
- `.github/`: a `geo` target in `publish-data.yml`, and `upload-asset.sh` takes the asset
  path as an argument.
- `CLAUDE.md`, `DATA_LICENSE.md`, `.gitignore` and the READMEs.
- `add-official-results-explorer` is archived before this change, because this change's
  deltas build on its specs.
- `docs/decisions.md`: D14 records the target to merge by 2026-10-23, so the runoff
  weekend needs no deploy.
