## 1. Before the work (Luiz, with help)

- [ ] 1.1 In `docs/decisions.md`, add to D14 this change's target, a merge by 2026-10-23 for each of its PRs alone, and its order against the runoff change. Luiz confirms both in the proposal's review

## 2. Web: look, fonts and names (the foundation PR)

- [ ] 2.1 Add `@fontsource-variable/archivo` and `@fontsource-variable/public-sans` with `npx -y npm@11 install --save-exact --ignore-scripts`, and load each package's Latin file with the weight axis through `next/font/local`. Record both fonts and their license in `web/README.md`. Extend the production-headers test so that it fails on any font or stylesheet request to another host. Add a test that aborts the font requests and finds the page's text rendered in the fallback font. Record the two files' sizes in the PR
- [ ] 2.2 Declare the design tokens in `app/globals.css`, the component classes for results rows, and a Tailwind variant for `@media (scripting: enabled)`. Add a unit test that every text and background pair in the tokens, and white or `ink` on each map color, reaches a contrast of 4.5 to 1
- [ ] 2.3 Rebuild the page shell from the mockup: the header with the site's mark, the round and its date, a larger search box, the breadcrumbs, the footer and the 1,200-pixel column. Add the two rounds' dates to `src/lib/elections.ts`. Test that the header names the first round and its date in both languages, and make sure that the 360-pixel test, the footer credit test and the language link tests pass on the new shell
- [ ] 2.4 Add `displayName()` in `src/lib/names.ts`. Test every scenario of the title-case requirement, plus a hyphen, quote marks, parentheses, digits, "DRª.", "OLHO D'ÁGUA", a name that starts with "D'", and a name with no letter to change
- [ ] 2.5 Apply `displayName()` to candidates, municipalities and cities abroad where they enter the views: `raceResults()`, the candidate page and its metadata, the map labels, the municipality tables and lists, and, in the browser, the search results and the drill-down views. Test that a candidate page's heading, a results table row, a map legend, a municipality list, a search result for a candidate and for a municipality, and a station view show title case, and that searching for "FLAVIO" still finds Flavio Bolsonaro
- [ ] 2.6 Add the note on recased names to the sources page in both languages, with a test in `sources-view.test.tsx`
- [ ] 2.7 Run `displayName()` over every ballot name in the pinned summaries, every municipality and every city abroad. Attach three lists to the PR: the words that keep their capitals, every recased word of four letters or fewer, and every name with a period, a slash or a digit. Luiz reviews the lists before the merge
- [ ] 2.8 Build against the pinned version, and record the size of the São Paulo state deputy page with the new classes. If it exceeds the limit, shorten the table's markup in this PR

## 3. Web: the Brazil and state pages (the pages PR)

- [ ] 3.1 Add the headline function in `src/lib/headline.ts`, with its forms and their messages in both languages. Test each form and the order between them: a deputy race with "Eleito por QP" outcomes takes the Count form, a deputy race with no elected outcome takes the Seats form, the Senate names both winners with a plural verb, and a race with no elected or runoff outcome calls no one elected
- [ ] 3.2 Add the result cards, colored through the maps' ranking. Test that the President card of a state where the second in Brazil led takes the second color, that a third candidate takes the gray, that every colored card shows the candidate's name next to its color, that the Senate shows the elected candidates plus the next most voted, and that a runoff card states the runoff's date
- [ ] 3.3 Rebuild the Brazil page: headline, cards, turnout, map, and the full results after them. Test that the headline and both cards come before the map, and that every number the old page showed is still on it
- [ ] 3.4 Add the state tiles, their legend, their TSE credit and their list to the Brazil page. Test that the PE tile links to Pernambuco with the leader's share and shade, that each tile's accessible name equals its row in the list, that each row links to the state's President race page, that the list is closed by default, that the tiles and the list read without JavaScript, and that at 360 pixels the grid fits with tiles at least 44 pixels wide
- [ ] 3.5 Rebuild the state page with a server-rendered panel for each of Governor, Senate and President, each with its turnout, and the Governor map and municipality list inside the Governor panel. Add the deputy races as links with their elected counts, shown only when TSE elected someone. Test that the delivered HTML holds every panel's headline and cards, that the Federal District offers federal and district deputy links only, and that the votes-abroad page opens with the President headline and two cards and has no tab list
- [ ] 3.6 Add the tabs' CSS rules and client component. Test that `#senador` opens the Senate tab and paints its panel first, that the right arrow, Home and End move the selection, that choosing a tab sets the fragment without a new history entry, that a screen reader sees the tab roles and the selected state, that without JavaScript every panel shows, that the page does not show all panels before the script runs, that a `beforematch` event on the President panel selects its tab, and that with the tabs' script blocked a tab link still shows its panel
- [ ] 3.7 Add the closest municipalities to the Governor panel. Test the order by margin, a tie shown as a tie with a margin of zero, a state with one municipality showing no list, and the link to a municipality's view

## 4. Web: the race, candidate and drill-down pages (the last PR)

- [ ] 4.1 Lead each race page with its headline, and with cards in a majoritarian race. Test a Governor race page and a federal deputy race page, where the headline states the count elected and no card shows
- [ ] 4.2 Rebuild the candidate page: headline, outcome, stat tiles with the place in the race, the share map, and the largest municipalities. Test the headline of a candidate in the runoff, of an elected candidate and of a candidate with neither outcome, the place of a candidate, the largest municipalities of a fixture state, capped at six, that a candidacy under appeal shows its status, no place and no list, and that a Federal District candidate shows no list
- [ ] 4.3 Add a President candidate's share in each state and the count of states led. Test the order from the highest share, the count, and each state's link
- [ ] 4.4 Move the municipality, zone and station views, the sources page and every table to the tokens. Make sure that the drill-down tests, the 360-pixel test and the production-headers test pass

## 5. Launch

- [ ] 5.1 In each PR, record the largest exported page and its size, and make sure that the page size gate passes
- [ ] 5.2 Merge each PR by 2026-10-23, or hold it until the runoff change merges. If PR 3 misses the date, move its requirements and tasks to a follow-up change, and archive this change after PR 2
- [ ] 5.3 Merge no PR of this change from 2026-10-24 to 2026-10-26
- [ ] 5.4 After the last PR deploys, run the live checks on Chromium at desktop size and on WebKit as an iPhone 13: no security-policy violation, no horizontal scrolling, the tabs and the state tiles working. Luiz checks the pages on his phone
