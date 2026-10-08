## Context

See proposal.md for the motivation and the scope. This design builds on
`add-official-results-explorer`, whose specs become the base when it is archived.

The current state that shapes the approach:

- The pinned data version already holds `2026/t1/totais/municipio/cargo=<c>/uf=<UF>.parquet`
  for every race and area, with columns `municipio`, `tipo`, `numero`, `votos` and
  `cargo`. The pipeline reconciles these totals with TSE's own municipality totals.
  `municipios.parquet` maps each TSE code to IBGE's code through `cdi`, for 5,571
  municipalities, and lists 186 cities abroad without one.
- `prepare-data.ts` already reads the manifest, the summaries and `municipios.parquet`
  through the Worker, checks each file against the manifest, and runs DuckDB-WASM's Node
  build. The static pages read what it writes to `.data/`.
- The security policy allows data requests to the app's own origin and the Worker only.
  The Worker's free plan allows 100,000 requests a day.
- The Worker serves `v/<version>/` and `assets/duckdb-wasm/<version>/`.
  `upload-asset.sh` writes only under `assets/duckdb-wasm/`.
- The schema between the pipeline and the app does not change.

## Goals / Non-Goals

**Goals:**

- A map costs one request at run time, for its boundaries, and that file is cached
  forever.
- A map's colors and its list come from the same build-time values, so they never
  disagree.
- Each piece can ship in its own PR: the boundary asset, the maps, the candidate pages
  and the search box.

**Non-Goals:**

- No client-side query engine on the static pages. DuckDB-WASM stays on the
  municipality, zone and station views.
- No new file in the data version.

## Decisions

### D1. Map values come from the pinned version's municipality totals, at build time

`prepare-data.ts` reads `totais/municipio` for every race and area through the Worker,
checks each file against the manifest, and queries it with DuckDB's Node build. For each
mapped race and area, it writes `.data/mapas/<area>/<cargo>.json`. The pages read those
files at build time and embed what they need in their HTML.

- For a race for one person, each municipality gets the votes of each candidate with
  `tipo = 1`. For a deputy race, each party gets its valid candidate votes plus its list
  votes (`tipo = 2`). A candidate's party comes from the summary's candidate list, never
  from the digits of the ballot number.
- Valid votes per municipality are the sum of `tipo` 1 and 2.
- Before writing, the step adds up the municipalities and compares each candidate, each
  party and the valid votes with the area's summary. It reports every difference and
  fails. It never changes a value.
- A race page embeds, per municipality, the TSE code, IBGE code, name, most voted, margin
  and bin. That list renders as HTML, and the map script reads the same JSON from the
  page.
- A candidate page embeds, per municipality, that candidate's votes and the valid votes.

Alternatives rejected:

- The pipeline writes new map files into the data version. That adds a schema change on
  both sides and a publish, for values that `totais/municipio` already holds.
- DuckDB-WASM on the static pages. A 36 MB engine is too heavy for coloring a map.
- A map file per page fetched at run time from the Worker. It costs one more request for
  values that the page's HTML already carries in its list.

### D2. Boundaries are a pinned asset, simplified and projected before publishing

The staging script `web/scripts/stage-geo-assets.ts` runs in a publish job with no
secrets. It uses `mapshaper` at a locked version, and works in this order:

1. It downloads `BR_Municipios_2025.zip` from IBGE's server and checks the SHA-512
   pinned in `web/scripts/geo-assets.ts`.
2. It keeps one attribute, IBGE's municipality code.
3. It projects to an Albers equal-area projection for Brazil (`+proj=aea +lat_0=-12
   +lon_0=-54 +lat_1=-2 +lat_2=-22 +ellps=GRS80`). An equal-area map gives each
   municipality its true share of the map, and the browser does no projection math.
4. It drops each polygon part that lies more than 100 km from its municipality's largest
   part, such as Trindade and Martim Vaz in Vitória. A municipality made only of far
   islands, Fernando de Noronha, keeps its shape and is drawn in an inset on the
   Pernambuco map. The script prints every part that it drops.
5. It simplifies and quantizes into `br.json`, for the Brazil map, and one finer
   `<uf>.json` per state. It fails when a file exceeds its size budget: 1 MB for
   `br.json` and 600 KB for a state.
6. It writes `SHA256SUMS`.

`upload-asset.sh` takes the asset path as its second argument, and accepts only
`assets/duckdb-wasm/<version>` and `assets/geo/<edition>`. Its other rules stay: it never
overwrites, it resumes only when the files there equal the staged ones, and it uploads
`SHA256SUMS` last. `publish-data.yml` gains the target `geo`, with the same pair of jobs
as `duckdb-wasm`.

`geo-assets.ts` pins the SHA-256 of each output. A production build fetches each file
through the Worker and fails when one differs. The build also fails when a municipality
in the data has no boundary, or when a boundary has no municipality and is not one of
IBGE's two lagoon areas in Rio Grande do Sul, which are drawn as water.

Alternatives rejected:

- IBGE's Malhas API. It names no edition, and its output can change without notice, so
  nothing can be pinned.
- A third-party simplified set, such as geobr or tbrugz/geodata-br. Their licenses or
  source years are not stated.
- Projecting in the browser. It adds code to every page for a projection that never
  changes.

### D3. One SVG per map, with no pan and no zoom

The map component uses `d3-geo` with an identity projection over the projected
coordinates, and `topojson-client` for the areas and the state borders. It draws one SVG
whose `viewBox` scales to the page width. It never calls `preventDefault` on touch
events, so a swipe scrolls the page.

- It fetches its boundary file when the map nears the viewport. It checks the file's
  SHA-256 with `crypto.subtle` against the pin in the page's configuration, and only then
  parses it. Any failure shows the message from the spec, and the list stays.
- A mouse hover shows the details, and a click opens the municipality's view. A tap shows
  the details with a link.
- The SVG has `role="img"` with a title and a short description. The paths are hidden
  from screen readers, and keyboard users reach each municipality through the list.
- The frame is a `<figure>` that holds the SVG, the legend, the statement about the most
  voted, and both credits.

Alternatives rejected:

- Canvas. It has no hit areas or crisp export without extra code.
- Leaflet or MapLibre. They are built for tiles, pan and zoom, which this change does not
  want, and they cost more bundle size.
- SVG rendered into the HTML. The Brazil map would add megabytes to a page, and 994
  candidate pages would each carry their own.

### D4. Colors, bins and names

Two hues from the Okabe-Ito palette, which stays distinct for common color-vision
deficiencies, go to the first and second candidate or party of the race's whole area.
Each hue has three shades, one for each margin bin: under 5 points, from 5 to under 20,
and 20 or more. Other leaders are a single gray, and ties use a neutral hatch.

- Colors follow rank, never party. Party colors collide, because several parties on the
  right use blue.
- The share map on a candidate page uses one sequential hue in six steps: 0 to 10, 10 to
  20, 20 to 30, 30 to 40, 40 to 50, and 50 or more. Fixed steps keep two candidates'
  maps comparable.
- The bin names live in the message files. A working choice is "apertada", "clara" and
  "ampla", and "close", "clear" and "wide".

### D5. Candidate pages

President candidacies live at `/2026/presidente/<numero>/`. Governor and Senate
candidacies live at `/2026/<uf>/<cargo>/<numero>/`. English pages mirror both under
`/en`. `generateStaticParams` reads the summaries, so every candidacy with a destination
gets a page, 497 in all. A static `presidente` segment takes precedence over the dynamic
`[uf]` segment, so the two route trees do not collide.

Alternative rejected: one client-rendered page with query parameters. It would need a
data request per view, and search engines would not index candidates.

### D6. Search index built from the summaries

`prepare-data.ts` writes two files into the static export: `busca/<hash>/municipios.json`
and `busca/<hash>/candidatos.json`. The hash comes from their content, and `vercel.json`
marks the path immutable. The fields are exactly those in the spec, and a test fails on
any other field.

- The browser loads both files on the first focus of the search box. It normalizes names
  once with NFD, removes the marks, and lowercases them.
- A result matches when each typed word appears in the normalized name, or when the
  query equals a ballot number. Names that start with the query rank first, then names
  where a word starts with it, then the rest. Capitals and candidates with more votes
  break ties. The list shows at most 20 results and says when there are more.
- The box follows the WAI-ARIA combobox pattern, with a live region for the result count.

The index comes from the app's own origin, because it repeats names that the pages
already carry. A measured size goes into the PR. The budget is 400 KB compressed for
`candidatos.json`.

Alternatives rejected:

- Pagefind and similar page indexers. They index whole pages, and give less control over
  fields and ranking.
- Search through DuckDB-WASM. It would load the 36 MB engine to search a list of names.

### D7. The municipality list as the text equivalent

The existing municipality list on the state page becomes a table in the HTML of each
mapped page. Its columns are the municipality as a link, the most voted, the margin and
the bin. It sorts by name by default. A small script adds sorting by margin and a filter
by name. Without JavaScript, the table stays complete and unsorted by margin.

### D8. Worker

`PREFIXES` in `worker/src/keys.ts` gains `["assets", "geo"]`. The segment and length
rules stay. `.json` already has its content type, so the boundaries use that extension.

## Risks / Trade-offs

- [IBGE's download page states no license] → Before the first `geo` publish, read IBGE's
  terms of reuse, record them and their credit line in `DATA_LICENSE.md`, and stop the
  change if they forbid redistribution.
- [Large Amazon municipalities dominate the Brazil map] → The legend says that colors
  show the most voted per municipality. Circles sized by votes are a later change.
- [A visitor reads "most voted" as "elected"] → The statement sits inside the map frame,
  and the outcome stays on the results tables.
- [5,570 paths are slow on a low-end phone] → The size budgets in D2 limit the paths. A
  task measures the Brazil map at 6x CPU throttling and records the time in the PR.
- [The island rule drops a real part of a municipality] → The script prints every
  dropped part. A test checks that only the known islands drop.
- [About 1,000 more pages lengthen the build] → A task records the build time. Vercel
  allows 45 minutes.
- [Fifteen days to the runoff] → The work splits into four PRs in the order of the
  tasks. The maps can ship without the candidate pages or the search box.

## Migration Plan

1. Archive `add-official-results-explorer` after its launch tasks pass.
2. Merge the asset PR. Approve the Worker deploy, run "Publish data" with target `geo`,
   approve the upload, and pin the hashes in `geo-assets.ts`.
3. Merge the maps PR, then the candidate pages PR, then the search PR. Vercel deploys
   each one.

Rollback is a revert PR. The boundary files stay in R2, unused and harmless.

## Open Questions

- The final hex values of the two hues and the gray. They can change without touching
  the specs.
- The final wording of the bin names in both languages.
