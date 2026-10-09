## 1. Before the work (Luiz, with help)

- [ ] 1.1 Merge the archive of `redesign-results-pages` (PR 35), so this change's deltas have their base
- [ ] 1.2 In `docs/decisions.md`, add to D14 this change's order and dates: code by 2026-10-23, no deploy from 2026-10-24 to 2026-10-26, the round-2 publish and pin after TSE's files hold round 2

## 2. Pipeline: round 2 (the pipeline PR)

- [ ] 2.1 Add `ROUNDS[2]` with President 6258, the state races 6260 and no municipal election. Test that `round_config(2)` builds the round-2 results-site and CDN URLs
- [ ] 2.2 Add `tests/fixtures/build_runoff_fixtures.py`, which derives synthetic round-2 fixtures from the round-1 fixtures: the two most voted President candidates everywhere, one fixture state with a Governor runoff, and TSE's results-site JSON for 6258 and 6260. Mark the numbers as synthetic in the fixture README
- [ ] 2.3 Test a round-2 build on the fixtures: a state without a Governor runoff gets President only, the runoff state gets both races, the manifest says round 2, reconciliation passes, and a station row changed by one vote fails the build
- [ ] 2.4 Add the `round` input to the data target of `publish-data.yml` and pass it to `eleicoes build`. Run `actionlint`

## 3. Web: data per round (the web data PR)

- [ ] 3.1 Replace `DATA_VERSION` with `DATA_VERSIONS`, a pin for round 1 and an optional one for round 2. Test that a version whose manifest names another year or round fails the build, and that no round-2 pin builds
- [ ] 3.2 Move `.data/` round files under `.data/rounds/<round>/`, and give the data accessors a round that defaults to 1. Make sure that every round-1 page renders the same HTML as before, apart from the build's hashes
- [ ] 3.3 Export the round-2 web fixtures from the pipeline's round-2 fixtures into `web/fixtures-t2/`, and let `ELEICOES_DATA=fixtures` read both rounds. Test that the fixture build holds round-2 summaries and map values
- [ ] 3.4 Give the drill-down configuration a data base per pinned round, and build the address's round into its file paths. Test a round-2 station view on the fixtures

## 4. Web: round-2 pages (the web pages PR)

- [ ] 4.1 Find out whether the static export accepts an empty `generateStaticParams()` for a dynamic route, and settle decision 4 of the design before the other tasks
- [ ] 4.2 Add the round-2 routes in both languages, rendering the round-1 views with the round. Test the Brazil, state, abroad and race pages and the three drill-down views of round 2 on the fixtures
- [ ] 4.3 Add the waiting page at `/2026/segundo-turno/` for a build with no round-2 pin. Test that it states the date, shows no number, and that no other round-2 page exists
- [ ] 4.4 Make the header's chip a switch between the rounds, with each page's counterpart. Test a state with a runoff, a race with no runoff that falls back to the round-2 Brazil page, `aria-current`, and both languages
- [ ] 4.5 Add the round-2 card to the round-1 Brazil page. Test it before and after a round-2 pin
- [ ] 4.6 Make the headlines, cards and ranks round-aware. Test "vence no 2º turno" in both languages, no runoff date on a round-2 card, and that the round-1 runner-up keeps the second color when it wins round 2
- [ ] 4.7 Build the round-2 map values with the round-1 color race, and draw the round-2 maps. Test the President and Governor maps of the runoff fixture state, and no map for an area with one municipality
- [ ] 4.8 Add the round-2 section to a finalist's candidate page. Test a finalist's page, a non-finalist's page with round 1 only, and that the headline is the round-2 one
- [ ] 4.9 List both pinned versions on the sources page, with a test in `sources-view.test.tsx`
- [ ] 4.10 Record the largest exported page and the size of a finalist's page in the PR. Make sure that the page size gate passes

## 5. Launch

- [ ] 5.1 Merge PRs 2 to 4 by 2026-10-23, and nothing from 2026-10-24 to 2026-10-26
- [ ] 5.2 After TSE's open data holds round 2, run "Publish data" with round 2, and record the run, the version and its size
- [ ] 5.3 Open the pin PR for round 2. Make sure that its build passes against the real version, then recut the round-2 fixtures from the real files in the same PR
- [ ] 5.4 After the pin deploys, run the live checks on Chromium at desktop size and on WebKit as an iPhone 13: no security-policy violation, no horizontal scrolling, the switch, the maps and a round-2 station view working. Luiz checks the pages on his phone
- [ ] 5.5 If TSE recounts Rio's round 1, run "Publish data" with round 1 and open a pin PR for it, outside the freeze

## 6. Later: the swing map (its own PR)

- [ ] 6.1 Map each finalist's change in share between the rounds, by municipality, with a diverging palette that is neither candidate color, a legend, and a list of municipalities. Test a gain and a loss, the text that compares two official counts, and that no text claims where any voter went
- [ ] 6.2 Measure the finalists' pages with the swing map. If a page exceeds the size limit, take issue 31 first
