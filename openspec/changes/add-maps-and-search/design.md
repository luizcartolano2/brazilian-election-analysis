## Context

See proposal.md for the motivation and the scope. This design builds on
`add-official-results-explorer`, whose specs become the base when it is archived.

The current state that shapes the approach:

- The pinned data version already holds `2026/t1/totais/municipio/cargo=<c>/uf=<UF>.parquet`
  for every race and area, with the columns `municipio`, `tipo`, `numero` and `votos`.
  DuckDB adds `cargo` from the path. The pipeline checks each candidate's votes per
  municipality and zone against TSE's own file. Party-list votes per municipality have no
  independent TSE file. They are sums of station figures that passed the station checks.
- `candidatos.parquet` holds each candidacy's party number and federation. Five
  federations ran in 2026, each party belongs to at most one in a state, and the other
  parties have no federation.
- `municipios.parquet` maps each TSE code to IBGE's code through `cdi`, for 5,571
  municipalities, and lists 186 cities abroad without one.
- `prepare-data.ts` already reads the manifest, the summaries and `municipios.parquet`
  through the Worker, checks each file against the manifest, and runs DuckDB-WASM's Node
  build. Its municipality list does not carry the IBGE code yet.
- The summaries hold 18,851 candidacies, with President repeated in each state's
  summary. They leave out the Conselheiro Distrital race.
- The security policy allows data requests to the app's own origin and the Worker only.
  The Worker's free plan allows 100,000 requests a day. Vercel Hobby pauses the project
  instead of billing for extra bandwidth.
- The largest page today is São Paulo's state deputy race, at 2.06 MB of HTML.
- The schema between the pipeline and the app does not change.

## Goals / Non-Goals

**Goals:**

- A map costs one request at run time, for its boundaries, and the browser caches that
  file for a year.
- A map's colors and its list come from the same build-time values, so they never
  disagree.
- Each piece ships in its own PR, search first.

**Non-Goals:**

- No client-side query engine on the static pages. DuckDB-WASM stays on the
  municipality, zone and station views.
- No new file in the data version.

## Decisions

### D1. Map values come from the pinned version, at build time

`prepare-data.ts` reads `totais/municipio` for every race and area, and
`candidatos.parquet`, through the Worker. It checks each file against the manifest and
queries it with DuckDB's Node build. It writes `.data/mapas/<area>/<cargo>.json` for each
mapped race and area, and adds the IBGE code to its municipality list.

- In a President, Governor or Senate race, each municipality gets the votes of each
  candidate with `tipo = 1`.
- In a deputy race, each party gets its valid candidate votes (`tipo = 1`) plus its list
  votes (`tipo = 2`). A candidate's party comes from the summary's candidate list, never
  from the digits of the ballot number. A party's federation comes from
  `candidatos.parquet`. A federation's votes are the sum of its parties' votes.
- Valid votes per municipality are the sum of `tipo` 1 and 2.
- Before writing, the step adds up the municipalities and compares the result with the
  area's summary:
  - Each candidate's votes.
  - Each party's valid candidate votes plus its valid list votes. The step computes the
    candidate votes from the summary's valid candidates, never from `votos_candidatos`,
    which also counts votes under appeal (issue #11). It counts `votos_legenda` only when
    the party's destination is "Válido (legenda)". A list under appeal keeps its votes in
    the summary, but those votes are annulled sub judice, so the map input leaves them
    out. The pinned summaries hold 21 such lists.
  - The valid votes.
- For Brazil, the sum covers every state and the cities abroad, because `br.json`
  includes them.
- The step reports every difference and fails. It never changes a value.
- Each page passes its values as props to a client component, which Next serializes and
  escapes. Nothing embeds an inline JSON script, because that needs
  `dangerouslySetInnerHTML`, which the lint rule bans.
- A race page passes, per municipality, the IBGE and TSE codes, the name, the two most
  voted with their votes, and the valid votes. One function derives the margin and the
  bin from them, for the map and for the list alike, and the list renders them as HTML.
- The Brazil page passes the same values for 5,571 municipalities, 282 KB before
  compression, and shows no list. That costs less than one more request to the Worker
  for every visit to the most visited page.
- A candidate page passes, per municipality, that candidate's votes and the valid votes.

Alternatives rejected:

- The pipeline writes new map files into the data version. That adds a schema change on
  both sides and a publish, for values that `totais/municipio` already holds.
- DuckDB-WASM on the static pages. A 36 MB engine is too heavy for coloring a map.
- A map file per page, fetched at run time from the Worker. It costs one more request for
  values that the page already carries, and it fails when the quota runs out.

### D2. Boundaries are a pinned build, simplified and projected before publishing

The staging script `web/geo/stage-geo-assets.ts` runs in a publish job with no secrets.
It uses `mapshaper` at a locked version, from its own package in `web/geo/`. `mapshaper`
brings 227 packages, two of them with install scripts, so it stays out of the app's own
install and out of Vercel's build. The script works in this order:

1. It downloads `BR_Municipios_2025.zip` from IBGE's server and checks the SHA-512
   pinned in `web/scripts/geo-assets.ts`.
2. It keeps one attribute, IBGE's municipality code.
3. It projects to an Albers equal-area projection for Brazil (`+proj=aea +lat_0=-12
   +lon_0=-54 +lat_1=-2 +lat_2=-22 +ellps=GRS80`). An equal-area map gives each
   municipality its true share of the map, and the browser does no projection math.
4. It drops each polygon part that lies more than 100 km from its municipality's largest
   part, measured between their bounding boxes. It fails when a dropped part is not on the written list in `geo-assets.ts`.
   That list starts with Trindade and Martim Vaz in Vitória, and the first real run is
   reviewed before anything is added to it. Fernando de Noronha keeps its shape, because
   it is its own municipality.
5. It simplifies and quantizes into `br.json`, for the Brazil map, and one finer
   `<uf>.json` per state. It fails when a file exceeds its budget, counted in raw bytes:
   1 MB for `br.json` and 600 KB for a state.
6. It reads the pinned data version's manifest and `municipios.parquet` through the
   Worker, with DuckDB's Parquet extension from the Worker too. It fails when a
   municipality with an IBGE code has no area, or when an area has no municipality and
   is not one of IBGE's two lagoon areas in Rio Grande do Sul. It runs this check on the
   source, and again on the written files, where each municipality must also sit in its
   own state's file.
7. It writes `manifest.json`, with the source URL and SHA-512, the commit, the data
   version of the join check, the `mapshaper` version, the settings, the dropped parts
   and IBGE's credit, then `SHA256SUMS`.

Each boundary file holds one TopoJSON object, `municipios`, with a `bbox`. Each geometry
carries the IBGE code as a numeric `id`, and no properties. The lagoon areas carry their
own codes. A state file takes the app's lowercase area code, such as `pe.json`.

The build id is `<YYYYMMDD>-<short commit>-<run id>`, as for data versions, and the path
is `assets/geo/ibge-2025/<build id>/`. A fix to the boundaries therefore gets a new path,
and nothing is ever overwritten. Same source, same `mapshaper` version and same settings
give the same bytes, so anyone can rerun the staging and compare with `SHA256SUMS`.

`upload-asset.sh` takes the asset path as its second argument, and accepts only
`assets/duckdb-wasm/<version>` and `assets/geo/ibge-2025/<build id>`. Its other rules
stay: it never overwrites, it resumes only when the files there equal the staged ones,
and it uploads `SHA256SUMS` last. `publish-data.yml` gains the target `geo`, with the
same pair of jobs as `duckdb-wasm`.

`geo-assets.ts` pins the build path and the SHA-256 of each output. A production build
fetches each file through the Worker and fails when one differs. The build repeats the
join check of step 6.

Fixture boundaries live in `web/fixtures-geo/`, generated by the staging script for the
fixture municipalities. They cannot live in `web/fixtures/`, because the pipeline's
fixture export deletes that folder and CI requires it to match the pipeline output.

Alternatives rejected:

- IBGE's Malhas API. It names no edition, and its output can change without notice, so
  nothing can be pinned.
- A third-party simplified set, such as geobr or tbrugz/geodata-br. Their licenses or
  source years are not stated.
- Projecting in the browser. It adds code to every page for a projection that never
  changes.
- One fixed path per IBGE edition. A fix found after the publish would need a path the
  specs do not name.

### D3. One SVG per map, with no pan and no zoom

The map component uses `d3-geo` with an identity projection over the projected
coordinates, and `topojson-client` for the areas and the state borders. It draws one SVG
whose `viewBox` scales to the page width. It never calls `preventDefault` on touch
events, so a swipe scrolls the page.

- It fetches its boundary file when the map nears the viewport, with a 30-second
  timeout. It checks the file's SHA-256 with `crypto.subtle` against the pin, and only
  then parses it. A failed download, a timeout or a different checksum shows the message
  from the spec, and the list stays.
- A mouse hover shows the details, and a click opens the municipality's view. A tap shows
  the details with a link.
- The SVG has `role="img"` with a title and a short description. The paths are hidden
  from screen readers, and keyboard users reach each municipality through the list.
- The frame is a `<figure>` that holds the SVG, the legend and both credits.
- Pernambuco's maps draw Fernando de Noronha in an inset box. Otherwise the island, far
  off the coast, would widen the map by about a third.

Alternatives rejected:

- Canvas. It has no hit areas or crisp export without extra code.
- Leaflet or MapLibre. They are built for tiles, pan and zoom, which this change does not
  want, and they cost more bundle size.
- SVG rendered into the HTML. The Brazil map would add megabytes to a page, and 994
  candidate pages would each carry their own.
- Boundaries copied into the static export, served by Vercel. That saves the Worker
  request, but it moves about 1 MB per first visit to Vercel's bandwidth, and Hobby
  pauses the project when it runs out.

### D4. Colors, bins and names

Two hues from the Okabe-Ito palette, which stays distinct for common color-vision
deficiencies, go to the first and second of the race's whole area. Each hue has three
shades, one for each margin bin. Other leaders are a single gray, and ties use a neutral
hatch.

- The bins cut at 5 and 20 points, as g1's results map does. A reader who knows that
  map reads ours the same way.
- Colors follow rank, never party. Party colors collide, because several parties on the
  right use blue.
- Deputy maps color federations, or parties outside any federation, because seats go to
  the federation as a unit. A federation's label is the short form after " - " in its
  name, or its name without the word "FEDERAÇÃO".
- Senate maps use one shade per candidate and no bins. Two candidates win, so the gap
  between the first and the second most voted does not describe a contest.
- A share map uses one sequential hue. Its steps are 0 to 10, 10 to 20, 20 to 30, 30 to
  40, 40 to 50 and 50 or more for President and Governor. For the Senate they are 0 to 5,
  5 to 10, 10 to 15, 15 to 20, 20 to 25 and 25 or more, because each voter chose two and
  shares of valid votes run about half as high.
- The bin names live in the message files. A working choice is "apertada", "clara" and
  "ampla", and "close", "clear" and "wide".

### D5. Candidate pages

President candidacies live at `/2026/presidente/<numero>/`. Governor and Senate
candidacies live at `/2026/<uf>/<cargo>/<numero>/`. English pages mirror both under
`/en`. `generateStaticParams` reads the summaries: President from `br.json`, Governor and
Senate from each state's summary. That gives 497 pages in each language. A static
`presidente` segment takes precedence over the dynamic `[uf]` segment, as `fontes` and
`municipio` already do.

- A candidacy whose destination is "Anulado sub judice" shows its votes as under appeal,
  with TSE's status, and no share map.
- A candidate in the Federal District gets no share map, because the district has one
  municipality.
- A President candidate's municipality table groups rows by state, in collapsed
  sections, so the page stays readable on a phone.
- Each address names a candidacy, not a round. The runoff change adds round 2 to the same
  page, so links and search engine entries stay valid.

Alternative rejected: one client-rendered page with query parameters. It would need a
data request per view, and search engines would not index candidates.

### D6. Search index built from the summaries

`prepare-data.ts` writes two files into the static export: `busca/<hash>/municipios.json`
and `busca/<hash>/candidatos.json`. The hash comes from their content, `vercel.json`
marks the path immutable, and `.gitignore` excludes `web/public/busca/`. The fields are
exactly those in the spec, and a test fails on any other field. President candidacies
come from `br.json` only.

- The browser loads both files on the first focus of the search box. It normalizes names
  once with NFD, removes the marks, and lowercases them.
- Matching starts at two typed characters. A result matches when each typed word
  appears in the normalized name, or when the query equals a ballot number. A full
  ballot number ranks first. Names that start with the query rank next, then names where
  a word starts with it, then the rest. Within a rank, municipalities come before
  candidacies, and capitals and candidates with more votes break ties. The list shows at
  most 20 results and says when there are more.
- A full ballot number lists every candidacy that holds it, even past 20. Each state
  numbers its own candidacies. On the pinned data, 77 numbers belong to more than 20
  candidacies, and some recur in all 27 states. A cap of 20 hides some of them, and no
  longer query reaches the hidden ones.
- The box follows the WAI-ARIA combobox pattern, with a live region for the result count.

The index comes from the app's own origin. Only GitHub Actions publishes to R2, and the
index is part of the app's build, like the page HTML that already carries the same
names. Its budget is 400 KB compressed for `candidatos.json`, measured in its PR. The
amended invariant in `CLAUDE.md` allows this.

Alternatives rejected:

- Pagefind and similar page indexers. They index whole pages, and give less control over
  fields and ranking.
- Search through DuckDB-WASM. It would load the 36 MB engine to search a list of names.
- The pipeline publishes the index in a new data version. That adds a schema change and
  a publish, for names that the summaries already hold.

### D7. The municipality list as the text equivalent

The existing municipality list on the state page becomes a table in the HTML of each
state and race page with a map. Its columns are the municipality as a link, the most
voted, the margin and the bin. A Senate table instead shows the two most voted with
their shares, and has no margin. Every table sorts by name by default. A small script
adds a filter by name, and sorting by margin where the table has one. Without JavaScript, the table stays complete. On the
Brazil page, each state's row gains a link to its President race page.

### D8. Worker

`PREFIXES` in `worker/src/keys.ts` gains `["assets", "geo", "ibge-2025"]`. The prefix
names the edition, so that the build id is the version segment, as it is for the data
versions and the DuckDB assets. The Worker then refuses a build path itself and a file
outside a build without reading storage. A new IBGE edition needs its own prefix, in the
same change that stages it. The segment and length rules stay. `.json` already has its
content type, so the boundaries use that extension.

### D9. A size gate on the static export

The build script runs a check after `next build`, so it applies in CI and on Vercel. It
fails when any HTML file in the export exceeds 2,500,000 bytes. With its map and list,
the largest page, São Paulo's state deputy race, is 2,423,481 bytes.

### D10. Worker requests per visit

| Visit | Before | After |
|---|---|---|
| Brazil, state or race page | 0 | 1, the boundary file, then cached for a year |
| Candidate page (new) | | 1, cached as above |
| Search | 0 | 0, from the app's own origin |
| Municipality, zone or station view | unchanged | unchanged |

Map clicks and search results lead to the municipality view, which reads Parquet through
the Worker. A task measures that view's requests and records the figure in the maps PR.
If the quota runs out, the static pages still show every number, and only the maps show
their message.

## Risks / Trade-offs

- [IBGE's download page states no license] → Before the first `geo` publish, read IBGE's
  terms of reuse and record them in `DATA_LICENSE.md`. Stop the change if they forbid
  redistribution.
- [Large Amazon municipalities dominate the Brazil map] → The legend says that colors
  show the most voted per municipality. Circles sized by votes are a later change.
- [A visitor reads "most voted" as "elected"] → The statement sits inside the map frame,
  and the outcome stays on the results tables.
- [Deputy maps rest on list votes with no independent TSE check] → They are sums of
  station figures that passed the station checks, and each state's list totals match
  TSE's aggregate. This design records the gap, and a methodology page can explain it
  later.
- [5,571 paths are slow on a low-end phone] → The size budgets in D2 limit the paths. A
  task measures the Brazil map at 6x CPU throttling and records the time in the PR.
- [About 1,000 more pages lengthen the build] → A task records the build time. Vercel
  allows 45 minutes.
- [Vercel previews cannot load the maps] → The Worker refuses preview origins, so maps
  show their message there. Reviewers check maps on a local build at
  `http://localhost:3000`.
- [Fifteen days to the runoff] → The work splits into PRs in the order of the tasks.
  Search ships first, and the maps can ship without the candidate pages.

## Migration Plan

1. Archive `add-official-results-explorer` after its launch tasks pass.
2. Merge the search PR.
3. Merge the Worker PR and approve its deploy. Merge the asset PR, run "Publish data"
   with target `geo`, approve the upload, and pin the build in `geo-assets.ts`.
4. Merge the maps PR, then the candidate pages PR. Vercel deploys each one.

Rollback is a revert PR. Published boundary builds stay in R2, unused and harmless.

## Open Questions

- The final hex values of the two hues and the gray. They can change without touching
  the specs.
- The final wording of the bin names in both languages.
