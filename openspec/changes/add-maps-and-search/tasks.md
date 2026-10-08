## 1. Before the work (Luiz, with help)

- [ ] 1.1 Archive `add-official-results-explorer` once its tasks 6.1 and 6.3 pass, so this change's deltas have a base
- [ ] 1.2 Read IBGE's terms of reuse for the municipal boundaries. Record the terms, the date checked and the credit line in both languages in `DATA_LICENSE.md`. Stop the change if the terms forbid redistribution

## 2. Boundary asset: staging and publishing (the asset PR)

- [ ] 2.1 Add `mapshaper` as a locked development dependency, and `web/scripts/geo-assets.ts` with the IBGE source URL and its SHA-512. Test that a source with another SHA-512 stops staging with no output
- [ ] 2.2 Add `web/scripts/stage-geo-assets.ts`, which keeps the IBGE code, projects, drops far parts, simplifies, quantizes and writes `br.json`, one file per state and `SHA256SUMS`. Test on a small synthetic shapefile that a far island drops and is printed, that an island-only municipality keeps its shape, that the IBGE code is the only attribute, and that a file over its budget fails
- [ ] 2.3 Generate the boundaries of the fixture municipalities into `web/fixtures/geo/` with the staging script, and commit them. Test that they cover every municipality in the fixtures
- [ ] 2.4 Change `upload-asset.sh` to take the asset path as its second argument, accepting only `assets/duckdb-wasm/<version>` and `assets/geo/<edition>`. Test that a boundary path uploads, that any other path is refused before any call, and that every existing asset test passes with the new argument
- [ ] 2.5 Add the `geo` target to `publish-data.yml`, with a staging job that holds no secret and an upload job in `data-publish`. Run `actionlint`
- [ ] 2.6 After the merge, Luiz runs "Publish data" with target `geo` and approves the upload. Record the run, the file sizes and the SHA-256 of each file

## 3. Worker (the asset PR)

- [ ] 3.1 Add `assets/geo` to the Worker's allowed prefixes. Test that a boundary file returns with the JSON content type and the immutable cache header, and that a key under any other `assets/` folder returns 404 without reading storage. After the merge, Luiz approves the deploy

## 4. Web: map values and checks (the maps PR)

- [ ] 4.1 Pin the published boundary files in `geo-assets.ts`. In `prepare-data.ts`, fetch them through the Worker in a production build and fail on any difference, and serve `web/fixtures/geo/` under `/_fixtures/` in a fixtures build. Test a missing file and a changed file
- [ ] 4.2 Read `totais/municipio` for every race and area in `prepare-data.ts`, check each file against the manifest, and write `.data/mapas/<area>/<cargo>.json`. Take a deputy candidate's party from the summary's candidate list. Test a party's total, and that a number whose digits suggest another party still counts for its listed party
- [ ] 4.3 Check that the municipalities add up to each summary for every candidate, every party and the valid votes. Test that a one-vote difference fails the build and names the candidate, the area and both numbers, and that every difference is reported
- [ ] 4.4 Check the join between data and boundaries. Test that a municipality without a boundary fails the build, that an unmatched boundary fails unless it is one of the two lagoon areas, and that cities abroad are left off the maps
- [ ] 4.5 Compute the most voted, the margin, the bin and the color of each municipality. Test a 3.2-point margin in the lightest shade, a tie, a minor leader in gray, a deputy race by party, and a President map of a state that keeps Brazil's top two

## 5. Web: the maps (the maps PR)

- [ ] 5.1 Add `d3-geo` and `topojson-client`, and the map component: it fetches its boundary file near the viewport, checks the SHA-256, and draws one SVG in a frame with the legend, the statement about the most voted, and the TSE and IBGE credits. Test that an altered boundary file draws no map, shows the message and keeps the list, and that the frame holds the race, the round, the legend, the statement and both credits
- [ ] 5.2 Put the President map on the Brazil page with its link to the votes abroad, the Governor map on each state page, and each race's map on its race page, with Fernando de Noronha in an inset on Pernambuco's maps. Test each page, and that the Federal District and abroad show no map
- [ ] 5.3 Add the details on hover and on tap, and the click to the municipality's view. Test that a click on Recife opens its view on the race shown, that a tap at 360 pixels shows the details with a link, and that a swipe on the map scrolls the page
- [ ] 5.4 Render the municipality table in the HTML of each mapped page, with sorting by margin and a filter that ignores case and accents. Test that the table is complete without JavaScript and says that the map needs it, that sorting puts the closest margin first, and that "sao" keeps every name with "São"
- [ ] 5.5 Add the new messages in Portuguese and English, and make sure that the key-set test passes
- [ ] 5.6 Add the mapped pages to the 360-pixel test and to the production-headers test. Measure the Brazil map at 6x CPU throttling, and record the time in the PR

## 6. Web: candidate pages (the candidate pages PR)

- [ ] 6.1 Add `/2026/presidente/<numero>/` and `/2026/<uf>/<cargo>/<numero>/` in both route trees, generated from the summaries. Test that 497 pages exist in each language, and that a page's address opens the same candidate
- [ ] 6.2 Show the ballot name, number, party, votes, share and outcome, the share map in six fixed steps, and the table of votes and share per municipality. Test a Governor candidate, a President candidate, and a candidacy with annulled votes, which shows no share map
- [ ] 6.3 Link each candidate in a President, Governor or Senate race table to their page. Test one link in each race
- [ ] 6.4 Record the build time and the size of the static export in the PR

## 7. Web: search (the search PR)

- [ ] 7.1 Write `busca/<hash>/municipios.json` and `busca/<hash>/candidatos.json` in `prepare-data.ts`, and mark `/busca/` immutable in `vercel.json`. Test that an entry with a field outside the allowed ones fails the build, and record the compressed size of `candidatos.json` in the PR
- [ ] 7.2 Add matching and ranking. Test "sao jose", "lisboa", a full ballot number, quotes with `%`, `_` and `*`, the ranking order, and the cap of 20 results with its note
- [ ] 7.3 Add the search box to the header of every page, loading the index on first focus. Test that a page load requests no index, that the down arrow twice and Enter open the second result, that Escape closes the list, that the result count is announced, and that without JavaScript no box shows
- [ ] 7.4 Send each result to its place: a municipality or a city abroad to its view, a President, Governor or Senate candidacy to its page, and any other candidacy to its race page with its row in view. Test each kind

## 8. Launch (Luiz, with help)

- [ ] 8.1 On `eleicoes.luizcartolano.com`, open the Brazil, a state, a race and a candidate page on a phone and a desktop, use the search box, and make sure that no page reports a policy violation
- [ ] 8.2 Describe the maps, the boundaries and the search box in `web/README.md`, and update the status in `README.md`
