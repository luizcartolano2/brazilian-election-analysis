## 1. Before the work (Luiz, with help)

- [x] 1.1 Merge the archive of `redesign-results-pages` (PR 35), so this change's deltas have their base
- [x] 1.2 In `docs/decisions.md`, amend D13 to one pinned version per round, and add to D14 this change's order and dates: code by 2026-10-23, no deploy from 2026-10-24 to 2026-10-26, the round-2 publish and pin after TSE's files hold round 2. Update the run-time invariant in `CLAUDE.md` and the runoff milestone in `README.md`
- [x] 1.3 Find out whether the static export accepts an empty `generateStaticParams()` for a dynamic route. It does not, so decision 4 of the design lists the round-2 addresses that exist before the pin

## 2. Pipeline: round 2 (the pipeline PR)

- [x] 2.1 Add `ROUNDS[2]` with President 6258, the state races 6260 and no municipal election. Test that `round_config(2)` builds the round-2 results-site and CDN URLs
- [x] 2.2 Add `tests/fixtures/build_runoff_fixtures.py`, which derives synthetic round-2 fixtures from the round-1 fixtures: the President finalists everywhere, Acre's Governor finalists, and TSE's results-site JSON for 6258 and 6260. Mark the numbers as synthetic in the fixture README
- [x] 2.3 Test a round-2 build on the fixtures: a state without a Governor runoff gets President only, the runoff state gets both races, the manifest says round 2, reconciliation passes, and a station row changed by one vote fails the build
- [x] 2.4 Add the `round` input to the data target of `publish-data.yml` and pass it to `eleicoes build`. Run `actionlint`

## 3. Web: data per round (the web data PR)

- [x] 3.1 Replace `DATA_VERSION` with `DATA_VERSIONS`, a pin for round 1 and an optional one for round 2. Test that a version whose manifest names another year or round fails the build, and that no round-2 pin builds
- [x] 3.2 When round 2 is pinned, make the build fail unless the two pins agree: each round-2 race holds exactly the candidates that round 1 marks for a runoff in that race, and each race marked for a runoff appears in round 2. Test a matching pair, a round-2 race with another candidate, and a cancelled Rio runoff against a round-1 version that still marks it
- [x] 3.3 Move `.data/` round files, `municipios.json` included, under `.data/rounds/<round>/`, and give the data accessors a round that defaults to 1. Keep the search index on round 1 alone. Make sure that every round-1 page renders the same HTML as before, apart from the build's hashes and the round in the drill-down pages' configuration
- [x] 3.4 Export the round-2 web fixtures from the pipeline's round-2 fixtures into `web/fixtures-t2/`, and let `ELEICOES_DATA=fixtures` read both rounds. Mark every round-2 page of a fixture build as synthetic test data, in both languages, because the synthetic round 2 names a winner. Test that the fixture build holds round-2 summaries and map values, ranked by round 1, and that the mark reads as synthetic in both languages. Task 4.1 tests the mark on the pages
- [x] 3.5 Give the drill-down configuration a data base per pinned round, and build the address's round into its file paths. Give `RACES` in `src/lib/elections.ts` the round-2 election codes, and make the station link to TSE, `drilldown/model.ts` and the links between views use the view's round. Test a round-2 station view on the fixtures, with its TSE link under 6258 for President and 6260 for Governor

## 4. Web: round-2 pages (the web pages PR)

- [x] 4.1 Add the round-2 routes in both languages, rendering the round-1 views with the round. Before the pin, the state route lists every state and abroad, and the race route lists each state's President race. Test the Brazil, state, abroad and race pages and the three drill-down views of round 2 on the fixtures, and a state page with both races: Governor tab first, a map in each panel, and the closest municipalities in the Governor panel. Test that every round-2 page of the fixture build shows the synthetic mark
- [x] 4.2 Render the waiting content on every round-2 page in a build with no round-2 pin. Test that the Brazil, a state, a race and the station pages state the date and show no vote count or share, and that the station view requests no data
- [x] 4.3 Make the header's chip a switch between the rounds, with each page's counterpart. Test a state with a runoff, `/2026/sp/senador/` leading to the round-2 page of São Paulo, `aria-current`, a finalist's page whose links lead to its own round sections, the sources page, and both languages
- [x] 4.4 Add the round-2 card below the candidate cards of the round-1 Brazil page. Test it before and after a round-2 pin
- [x] 4.5 Make the headlines, cards and ranks round-aware. Test "vence no 2º turno" in both languages, no runoff date on a round-2 card, and that the round-1 runner-up keeps the second color when it wins round 2
- [x] 4.6 Draw the round-2 maps, from the map values that task 3.4 builds with the round-1 color race. Test the President and Governor maps of the runoff fixture state, and no map for an area with one municipality
- [x] 4.7 Add the round-2 section to a finalist's candidate page. Test a President finalist's page with its round-2 state shares, states led and note on the votes abroad, a finalist in an area with one municipality with no map and no list (the fixtures have no such runoff, so the round-1 test of the shared component covers it), a non-finalist's page with round 1 only, and that the headline is the round-2 one
- [x] 4.8 List both pinned versions, each with its round, on the sources page, with a test in `sources-view.test.tsx`
- [x] 4.9 Record in the PR the largest exported page and the largest finalist's page, against the 2.5 MB page size gate. Make sure that the gate passes

## 5. Launch

- [ ] 5.1 Merge PRs 2 to 4 by 2026-10-23, and nothing from 2026-10-24 to 2026-10-26
- [ ] 5.2 After TSE's open data holds round 2, run "Publish data" with round 2, and record the run, the version and its size
- [ ] 5.3 Open the pin PR for round 2. Make sure that its build passes against the real version, then recut the round-2 fixtures from the real files in the same PR, and delete `build_runoff_fixtures.py`
- [ ] 5.4 After the pin deploys, run the live checks on Chromium at desktop size and on WebKit as an iPhone 13: no security-policy violation, no horizontal scrolling, the switch, the maps and a round-2 station view working. Luiz checks the pages on a phone
- [ ] 5.5 If TSE recounts Rio's round 1, run "Publish data" with round 1 and open a pin PR for it, outside the freeze
