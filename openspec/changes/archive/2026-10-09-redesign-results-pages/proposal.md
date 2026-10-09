## Why

The site is correct but hard to read. Every page opens with an intro sentence and a
table, so a visitor has to read rows to learn who won. The headings, the tables and the
links all look alike, and the state page stacks five races one after another.

On 2026-10-08, Luiz reviewed a clickable mockup of the Brazil, state and candidate pages
and approved its four main choices. This change brings them to the site (issue 27).

## What Changes

- Each Brazil, state, race and candidate page opens with its result. A headline states
  TSE's outcome, for example that two candidates go to the runoff. Large cards then show
  the leading candidates with their share, votes and outcome. The map, the tables and
  the turnout follow. A runoff card states the runoff's date, and the header names the
  round and its date.
- A candidate keeps one color everywhere on a page. The race's most voted takes the
  maps' blue, the runner-up takes the maps' orange, and the others take gray. The cards,
  the share bars and the legends use the same colors as the maps.
- The Brazil page shows the 27 states as a grid of tiles in their rough geographic
  places. Each tile takes the color of the state's most voted President candidate,
  shaded by margin as on the maps, and links to the state. A list under the grid names
  each state's leader and share, and links to the state's President race page.
- The state page switches between its Governor, Senate and President races with tabs.
  The Governor tab holds the Governor map and the municipality list. The deputy races
  appear as links to their race pages, with the count of elected candidates. Without
  JavaScript, every race shows one after another, as today.
- The site shows candidates' ballot names, municipality names and the names of cities
  abroad in title case, for example "Flavio Bolsonaro" for TSE's "FLAVIO BOLSONARO" and
  "Abreu e Lima" for "ABREU E LIMA". The sources page says that TSE publishes them in
  capitals. Search still finds a name by either spelling.
- The candidate page adds the candidate's place in the race and a list of the area's
  largest municipalities with the candidate's share in each. A President candidate's
  page also lists the share in each state and counts the states that the candidate led.
- The Governor tab of a state page lists the five municipalities with the smallest
  margin.
- A new look for every page, the municipality, zone and station views included:
  - Archivo for headings and Public Sans for text, both served from the app's own
    origin.
  - A header with a larger search box and the round's date.
  - One set of colors, spacing and text sizes, defined once as design tokens.
- All new user-facing text ships in Portuguese and English.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `results-explorer`: pages lead with their result, the Brazil page gains the state
  tiles, the state page gains its race tabs, names show in title case, fonts load from
  the app's origin, and the headline numbers of every tab stay in the HTML.
- `results-maps`: a candidate keeps the maps' color outside the map, the Governor tab
  lists the closest municipalities, and the candidate page gains its place in the race,
  its largest municipalities and, for President, its share by state.
- `site-search`: results show names in title case instead of TSE's capitals.

## Invariants

This change touches these invariants in `CLAUDE.md`, and it keeps each one as follows:

- An estimate is never a count. The change shows no estimate. Every new number is an
  official count, a share of one, or a rank by official votes.
- No integrity claims. The closest municipalities appear only as the margin between two
  official counts. Nothing scores or flags a municipality, and nothing projects the
  runoff. A runoff card states only TSE's outcome and the date of the second round.
- The app reads only pinned data. The fonts are files in the app's own build, from
  packages in the lockfile. Every new number comes from the summaries and map files that
  the build already derives from the pinned version.
- TSE gets credit wherever its data appears. The footer and each map keep the credit.
  The state tiles carry it too, because they show TSE's numbers as colors.
- Every user-facing string exists in Portuguese and English.
- The app stays non-commercial. The redesign keeps the author credit and adds no
  promotion.
- Analytics loads only after consent. The change adds no third-party request, so no font
  request reaches Google.

The change depends on D10 (the static export), D11 (Portuguese first), D14 and D17. It
does not change the schema between the pipeline and the app.

## Order against the runoff

This change lands before the runoff change. The runoff results reuse this change's cards
and headline, so building them twice would waste days. Like the maps, the change
targets a merge by 2026-10-23 and leaves the runoff weekend free of deploys.

The date applies to each of the change's three PRs alone. A PR that misses it waits until
the runoff change merges. If the last PR misses it, its requirements and tasks move to a
follow-up change, and this change archives without them, so the runoff change builds on
archived specs.

## Non-goals

- No data playground and no filter builder. Issue 26 covers them.
- No comparison with 2022 (D17).
- No new data, no change to the pipeline, and no new data version.
- No runoff data and no round switch. The runoff change adds them.
- No dark theme.
- No change to any address. Every page keeps its URL, and the tabs add no new page.
- No new maps on the state page. The Senate and President tabs link to their race pages
  for the map, so a state page stays under the size limit.

## Impact

- `web/`: two font packages, `@fontsource-variable/archivo` and
  `@fontsource-variable/public-sans`, both under the SIL Open Font License. New design
  tokens in `app/globals.css`, a new page shell, result cards, state tiles, race tabs, a
  title-case function, and new message keys. The existing tables, maps and drill-down
  views take the new tokens.
- `web/e2e/`: tests for the tabs with and without JavaScript, the tiles' text list and
  the title case. The existing tests follow the new structure.
- `web/README.md` records the fonts and their license.
- `docs/decisions.md`: D14 records this change's target and its order against the runoff
  change.
