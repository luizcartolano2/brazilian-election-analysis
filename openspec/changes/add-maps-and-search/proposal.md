## Why

The first release shows its numbers only in tables. A visitor cannot see where a
candidate led, and reaches a municipality only through its state's list. Most visitors
will arrive around the runoff on 2026-10-25, so maps and a search box land before it
(D14).

A survey of the sites that publish TSE's results on 2026-10-08 shaped the scope. g1,
Poder360 and O Tempo draw municipality maps with no street basemap. Nexo goes down to
each polling place, but it loads a third party's map tiles. Every site that maps the
results colors each area by its most voted candidate, shaded by margin.

## What Changes

- A new publish target stages IBGE's 2025 municipal boundaries as simplified TopoJSON,
  pinned by SHA-256, under `assets/geo/ibge-2025/`. The Worker serves that path like the
  DuckDB assets.
- The build reads the municipality totals that the pinned data version already holds,
  checks them against the manifest, and checks that they add up to each summary. The
  build fails on any mismatch. Each page then carries its own map data in its HTML, so a
  map needs one request at run time, for its boundaries.
- The Brazil page maps the President race by municipality. Each state page maps its
  Governor race, and each race page maps its own race.
- Each map colors the most voted candidate in each municipality, shaded by margin in
  three named bins. Deputy races color the most voted party. The top two candidates or
  parties of the race get colors, and the others share one gray.
- The maps have no basemap, no pan and no zoom. A click opens the municipality's view.
  The legend, the TSE credit and the IBGE credit sit inside each map's frame.
- Each mapped page lists its municipalities in its HTML, with the most voted candidate
  and the margin. A visitor can sort the list by margin and filter it by name. The list
  is the text equivalent of the map, and it reads without JavaScript.
- A static page for each of the 497 candidacies on the ballot for President, Governor
  and Senate shows the candidate's results and a map of their share by municipality.
  That is about 994 pages across both languages.
- A search box on every page finds municipalities, cities abroad and the 18,874
  candidacies on the ballot, and it ignores case and accents.
- `DATA_LICENSE.md` records IBGE's terms and credit line.
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

## Invariants

This change touches these invariants in `CLAUDE.md`, and it keeps each one as follows:

- An estimate is never a count. The change shows no estimate. Every color and number on
  a map is an official count or a share of one.
- No integrity claims. The maps show only the most voted candidate, the margin and a
  candidate's share. No map shows turnout, and nothing ranks or flags a municipality.
- Official numbers reconcile, or nothing publishes. The build fails when the municipality
  totals differ from the manifest or do not add up to their summary. It never adjusts a
  value to make the sums agree.
- Only GitHub Actions publishes data. The boundaries arrive through the publish
  workflow's new asset target. The change needs no new data version.
- The app reads only its pinned data version, through the Worker. The build reads the
  municipality totals of the pinned version through the Worker, as it reads the
  summaries. At run time, the boundaries come through the Worker.
- TSE gets credit wherever its data appears. Each map carries the TSE credit inside its
  frame, next to IBGE's.
- Every user-facing string exists in Portuguese and English.
- Never commit TSE downloads or pipeline outputs. IBGE's files are not committed either.
  Fixture boundaries cover the fixture municipalities only.
- Candidates' personal identifiers never leave the pipeline. The search index holds the
  ballot name, number, party, race, area and outcome only.

## Non-goals

- No basemap, pan or zoom.
- No circles per polling place. The coordinates stay in the data for a later change.
- No runoff data and no round switch. Those get their own change.
- No turnout or abstention map.
- No candidate pages or maps for deputy and council candidacies. Search sends them to
  their race page.
- No search for polling places outside a municipality. The existing place search stays.
- No comparison with 2022 (D17).
- No estimates (D16).
- No change to the pipeline or to the schema between the pipeline and the app.
- No visual redesign beyond what the maps and the search box need.

## Impact

- `web/`: `d3-geo` and `topojson-client` as dependencies, and `mapshaper` as a
  development dependency for the boundary staging script. A map component, the
  candidate pages, the search box, new message keys, and new checks in
  `prepare-data.ts` for the boundaries and the municipality totals.
- `worker/`: the key check accepts `assets/geo/<edition>/`.
- `.github/`: a `geo` target in `publish-data.yml`, and `upload-asset.sh` takes the asset
  path as an argument.
- `DATA_LICENSE.md` and the READMEs.
- `add-official-results-explorer` is archived before this change, because this change's
  deltas build on its specs.
- The change merges by 2026-10-23, so the runoff weekend needs no deploy.
