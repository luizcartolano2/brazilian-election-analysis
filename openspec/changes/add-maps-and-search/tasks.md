## 1. Before the work (Luiz, with help)

- [x] 1.1 Archive `add-official-results-explorer` once its tasks 6.1 and 6.3 pass, so this change's deltas have a base
- [x] 1.2 Read IBGE's terms of reuse for the municipal boundaries. In `DATA_LICENSE.md`, record the terms, the date checked and a credit line in both languages that says the boundaries were simplified, and keep the boundaries out of the project's CC BY grant. Stop the maps if the terms forbid redistribution

## 2. Web: search (the search PR)

- [x] 2.1 Amend the `CLAUDE.md` invariant on run-time reads, so that it allows the pinned boundary build through the Worker and files that the build derived from the pinned version, served from the app's own origin
- [x] 2.2 Write `busca/<hash>/municipios.json` and `busca/<hash>/candidatos.json` in `prepare-data.ts`, taking President from `br.json` only. Mark `/busca/` immutable in `vercel.json`, and add `web/public/busca/` to `.gitignore`. Test that an entry with a field outside the allowed ones fails the build, that each President candidacy appears once, and record the compressed size of `candidatos.json` in the PR
- [x] 2.3 Add matching and ranking. Test on a synthetic list "sao jose", "lisboa", a full ballot number, quotes with `%`, `_` and `*`, the ranking order, and the cap of 20 results with its note
- [x] 2.4 Add the search box to the header of every page, loading the index on first focus. Test that a page load requests no index, that the down arrow twice and Enter open the second result, that Escape closes the list, that the result count is announced, that an English page names the race "Senator", and that without JavaScript no box shows
- [x] 2.5 Send each result to its place: a municipality or a city abroad to its view, a President, Governor or Senate candidacy to its race page until task 7.3 adds candidate pages, and a deputy candidacy to its race page with its row in view. Test each kind
- [x] 2.6 Add pages with the search box open to the 360-pixel test and to the production-headers test

## 3. Worker (the Worker PR)

- [x] 3.1 Add `assets/geo/ibge-2025` to the Worker's allowed prefixes. Test that a boundary file returns with the JSON content type and the immutable cache header, and that a key under any other `assets/` folder returns 404 without reading storage
- [ ] 3.2 After the merge, Luiz approves the deploy. After task 4.7, make sure that the Worker serves a published boundary file with the JSON content type and the immutable cache header

## 4. Boundary asset: staging and publishing (the asset PR)

- [x] 4.1 Add `mapshaper` as a locked development dependency of its own package, `web/geo/`, and `web/scripts/geo-assets.ts` with the IBGE source URL, its SHA-512 and the list of expected dropped parts. Test that a source with another SHA-512 stops staging with no output
- [x] 4.2 Add `web/geo/stage-geo-assets.ts`, which keeps the IBGE code, projects, drops far parts, simplifies, quantizes and writes `br.json` and one file per state. Test on a small synthetic shapefile that a listed far island drops and is recorded, that an unlisted one fails the run, that an island-only municipality keeps its shape, that the IBGE code is the only attribute, and that a file over its raw-byte budget fails
- [x] 4.3 Add the join check against the pinned `municipios.parquet`, then `manifest.json` and `SHA256SUMS`. Test that a missing municipality fails before any upload, that an unmatched area fails unless it is one of the two lagoon areas, and that two runs on the same input give the same bytes
- [x] 4.4 Generate the boundaries of the fixture municipalities into `web/fixtures-geo/`, and commit them. Test that they cover every municipality in the fixtures, and that the pipeline's fixture export leaves them untouched
- [x] 4.5 Change `upload-asset.sh` to take the asset path as its second argument, accepting only `assets/duckdb-wasm/<version>` and `assets/geo/ibge-2025/<build id>`. Test that a boundary path uploads, that any other path is refused before any call, and that every existing asset test passes with the new argument
- [x] 4.6 Add the `geo` target to `publish-data.yml`, with a staging job that holds no secret and an upload job in `data-publish`. Run `actionlint`
- [ ] 4.7 After the merge, Luiz runs "Publish data" with target `geo` and approves the upload. Record the run, the build id, the file sizes and the dropped parts

## 5. Web: map values and checks (the maps PR)

- [ ] 5.1 Pin the published build in `geo-assets.ts`. In `prepare-data.ts`, fetch its files through the Worker in a production build and fail on any difference, and serve `web/fixtures-geo/` under `/_fixtures/` in a fixtures build. Test a missing file and a changed file
- [ ] 5.2 Read `totais/municipio` and `candidatos.parquet` in `prepare-data.ts`, check each file against the manifest, add the IBGE code to the municipality list, and write `.data/mapas/<area>/<cargo>.json`. Test that a deputy candidate's party comes from the summary even when the digits suggest another, and that a federation sums its parties
- [ ] 5.3 Check that the municipalities add up to each summary for every candidate, every party's valid candidate votes plus list votes, and the valid votes, with the cities abroad in the Brazil check. Test that a one-vote difference fails the build and names the candidate, the area and both numbers, that every difference is reported, that neither a candidate under appeal nor a party list under appeal breaks the party check, and that the Brazil check passes only with the cities abroad
- [ ] 5.4 Repeat the join check between data and boundaries in the build. Test that a municipality without a boundary fails, and that cities abroad stay off the maps
- [ ] 5.5 Compute the most voted, the margin, the bin and the color of each municipality. Test a 3.2-point margin in the lightest shade, a tie, a minor leader in gray, a deputy race by federation, a Senate race with one shade and no bins, and a President map of a state that keeps Brazil's top two

## 6. Web: the maps (the maps PR)

- [ ] 6.1 Add `d3-geo` and `topojson-client`, and the map component. It receives its values as props, fetches its boundary file near the viewport with a 30-second timeout, checks the SHA-256, and draws one SVG in a frame with the legend and the TSE and IBGE credits. Test that an altered file and a failed download each draw no map, show the message and keep the list, and that a Governor frame holds the race, the area, the round, the legend, the statement and both credits
- [ ] 6.2 Put the President map on the Brazil page with its link to the votes abroad, the Governor map on each state page, and each race's map on its race page, with Fernando de Noronha in an inset on Pernambuco's maps. Test each page, and that the Federal District and abroad show no map
- [ ] 6.3 Add the details on hover and on tap, and the click to the municipality's view. Test that a click on Recife opens its view on the race shown, that a tap at 360 pixels shows the details with a link, and that a swipe on the map scrolls the page
- [ ] 6.4 Render the municipality table in the HTML of each state and race page with a map, with sorting by margin and a filter that ignores case and accents. Link each state on the Brazil page to its President race page. Test that the table is complete without JavaScript and says that the map needs it, that sorting puts the closest margin first, that a Senate table shows the two most voted with shares and no margin, that the filter keeps a name with "São" when given "sao", and that each state's link leads to its President race page
- [ ] 6.5 List the boundaries on the sources page: IBGE's edition, terms, the simplification, and the build in use with a link to its manifest. Test that the sources page shows them
- [ ] 6.6 Add the new messages in Portuguese and English, and make sure that the key-set test passes
- [ ] 6.7 Add the size gate on the static export, failing above 2.5 MB of HTML per page. Test that a page over the limit fails and is named
- [ ] 6.8 Add the mapped pages to the 360-pixel test and to the production-headers test. Measure the Brazil map at 6x CPU throttling, and the Worker requests of one municipality view, and record both in the PR

## 7. Web: candidate pages (the candidate pages PR)

- [ ] 7.1 Add `/2026/presidente/<numero>/` and `/2026/<uf>/<cargo>/<numero>/` in both route trees, generated from the summaries. Test on the fixtures that each majoritarian candidacy gets a page in each language, and that a page's address opens the same candidate
- [ ] 7.2 Show the ballot name, number, party, votes, share and outcome, the share map in the steps of its race, and the table of votes and share per municipality, grouped by state for President. Test a Governor candidate, a President candidate, a Senate candidate with 5-point steps and the two-choice statement, a candidacy under appeal with no share map, and a Federal District candidate with no share map
- [ ] 7.3 Link each candidate in a President, Governor or Senate race table to their page, and point search results for these candidacies to their pages. Test one link in each race, and one search result
- [ ] 7.4 Add candidate pages to the 360-pixel test, the production-headers test and the language-switch test. Record the build time and the size of the static export in the PR

## 8. Launch (Luiz, with help)

- [ ] 8.1 Make sure that the production build log shows 497 candidate pages in each language and that the size gate passes
- [ ] 8.2 On `eleicoes.luizcartolano.com`, open the Brazil, a state, a race and a candidate page on a phone and a desktop, search for "sao jose" and "lisboa", and make sure that no page reports a policy violation
- [ ] 8.3 Describe the maps, the boundaries and the search box in `web/README.md`, and update the status in `README.md`
