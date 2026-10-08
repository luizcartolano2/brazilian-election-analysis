## 1. Before the work (Luiz, with help)

- [ ] 1.1 In `docs/decisions.md`, add to D14 this change's target, a merge by 2026-10-23, and its order against the runoff change. Luiz confirms both in the proposal's review

## 2. Web: look, fonts and names (the foundation PR)

- [ ] 2.1 Add `@fontsource-variable/archivo` and `@fontsource-variable/public-sans` with `npx -y npm@11 install --save-exact --ignore-scripts`, and load each package's Latin file with the weight axis through `next/font/local`. Record both fonts and their license in `web/README.md`. Extend the production-headers test so that it fails on any font or stylesheet request to another host, and record the two files' sizes in the PR
- [ ] 2.2 Declare the design tokens in `app/globals.css`, and a Tailwind variant for `@media (scripting: enabled)`. Add a unit test that every text and background pair in the tokens, and white or `ink` on each map color, reaches a contrast of 4.5 to 1
- [ ] 2.3 Rebuild the page shell from the mockup: the header with the site's mark, the round's date and a larger search box, the breadcrumbs, the footer and the 1,200-pixel column. Make sure that the 360-pixel test, the footer credit test and the language link tests pass on the new shell
- [ ] 2.4 Add `displayName()` in `src/lib/names.ts`. Test every scenario of the title-case requirement, plus a hyphen, an apostrophe, quote marks, parentheses, digits, "DRª." and a name with no letter to change
- [ ] 2.5 Apply `displayName()` where names enter the views: `raceResults()`, the candidate page and its metadata, the map labels and municipality tables, and, in the browser, the search results and the drill-down views. Test that a candidate page's heading, a results table row, a map legend, a search result and a station view show title case, and that searching for "FLAVIO" still finds Flavio Bolsonaro
- [ ] 2.6 Add the note on recased names to the sources page in both languages, with a test in `sources-view.test.tsx`
- [ ] 2.7 Run `displayName()` over every ballot name in the pinned summaries, and attach to the PR the list of words that keep their capitals. Luiz reviews the list before the merge

## 3. Web: the Brazil and state pages (the pages PR)

- [ ] 3.1 Add the headline function in `src/lib/headline.ts`, with its four forms and their messages in both languages. Test each form, and that a race whose candidates carry no elected or runoff outcome calls no one elected
- [ ] 3.2 Add the result cards, colored through the maps' ranking. Test that the President card of a state where the second in Brazil led takes the second color, that a third candidate takes the gray, and that the Senate shows the elected candidates plus the next most voted
- [ ] 3.3 Rebuild the Brazil page: headline, cards, turnout, map, and the full results after them. Test that the headline and both cards come before the map, and that every number the old page showed is still on it
- [ ] 3.4 Add the state tiles and their text list to the Brazil page. Test that the PE tile links to Pernambuco with the leader's share and shade, that the list names each state's most voted, that both read without JavaScript, and that at 360 pixels the grid fits with tiles at least 44 pixels wide
- [ ] 3.5 Rebuild the state page with a server-rendered panel for each of Governor, Senate and President, and the deputy races as links with their elected counts. Test that the delivered HTML holds every panel's headline and cards, and that the Federal District offers federal and district deputy links only
- [ ] 3.6 Add the tabs' client component. Test that `#senador` opens the Senate tab, that the right arrow, Home and End move the selection, that choosing a tab sets the fragment without a new history entry, that a screen reader sees the tab roles and the selected state, that without JavaScript every panel shows, and that the page does not show all panels before the script runs
- [ ] 3.7 Add the closest municipalities to the Governor tab. Test the order by margin, a tie shown as a tie with a margin of zero, a state with one municipality showing no list, and the link to a municipality's view

## 4. Web: the race, candidate and drill-down pages (the last PR)

- [ ] 4.1 Lead each race page with its headline, and with cards in a majoritarian race. Test a Governor race page and a federal deputy race page, where the headline states the count elected and no card shows
- [ ] 4.2 Rebuild the candidate page: headline, outcome, stat tiles with the place in the race, the share map, and the largest municipalities. Test the place of a candidate, the largest municipalities of a fixture state, capped at six, and that a candidacy under appeal shows no place and no list
- [ ] 4.3 Add a President candidate's share in each state and the count of states led. Test the order from the highest share, the count, and each state's link
- [ ] 4.4 Move the municipality, zone and station views, the sources page and every table to the tokens. Make sure that the drill-down tests, the 360-pixel test and the production-headers test pass

## 5. Launch

- [ ] 5.1 In each PR, record the largest exported page and its size, and make sure that the page size gate passes
- [ ] 5.2 Merge no PR of this change from 2026-10-24 to 2026-10-26
- [ ] 5.3 After the last PR deploys, run the live checks on Chromium at desktop size and on WebKit as an iPhone 13: no security-policy violation, no horizontal scrolling, the tabs and the state tiles working. Luiz checks the pages on his phone
