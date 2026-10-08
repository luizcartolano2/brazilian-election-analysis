## Context

See `proposal.md` for the motivation, and the two delta specs for the requirements.

The web app is a Next.js 16 static export with Tailwind 4. Every page renders on the
server from the build's `.data/` files, and only the map, the search box, the
language link and the drill-down views run in the browser. The current look is
Tailwind's defaults: `slate` grays, the system font, and a 768-pixel column.

The production CSP allows fonts and styles from the app's own origin only, and inline
styles. The page size gate fails the build when an exported page exceeds 2,500,000
bytes. The largest page today is the São Paulo state deputy race page, at 2,303,138
bytes.

Everything the new sections show already exists at build time:

- Each area's summary holds every race's candidates, votes, outcomes and totals.
- `getRaceMap()` holds each municipality's two most voted and its valid votes.
- `getCandidateVotes()` holds each President, Governor and Senate candidate's votes in
  each municipality.

## Goals / Non-Goals

**Goals:**

- One set of design tokens that every page and component uses.
- Each new number computed at build time from the files that the build already reads.
- The approved mockup's structure for the Brazil, state and candidate pages, which the
  race pages and the drill-down views follow through the shared components.

**Non-Goals:**

- No new client-side data loading. The tabs are the only new script, and they load no
  data.
- No component library or CSS-in-JS. Tailwind stays the only styling tool.
- No visual regression suite. The browser tests assert structure and text, as today.

## Decisions

### 1. The tokens live in Tailwind's theme, and the candidate colors stay in one file

`app/globals.css` declares the neutral palette, the two fonts, the text sizes and the
radii in Tailwind 4's `@theme` block. The neutrals come from the mockup:

| Token | Value | Use |
|---|---|---|
| `ink` | `#14171a` | Text and dark chips |
| `muted` | `#4b5563` | Secondary text, 7.6 to 1 on white |
| `surface` | `#f3f4f1` | Stat tiles, the footer, chips |
| `line` | `#e3e5e0` | Borders and rules |

The candidate colors stay in `src/lib/map-colors.ts`, and the cards, bars, tiles and
legends import them from there. A component sets them through an inline `style`, which
the CSP already allows.

Alternative: copy the map colors into CSS variables. That makes two sources for one
color, and a test would have to keep them equal. Reading the variables back in the map
code needs `getComputedStyle`, which does not run at build time.

The page column grows from 768 pixels to 1,200. Below 768 pixels, every section is one
column, as in the mockup.

### 2. Fonts come from npm packages, through `next/font/local`

The app adds `@fontsource-variable/archivo` and `@fontsource-variable/public-sans` at
version 5.3.0, both under the SIL Open Font License 1.1. `next/font/local` loads each
package's Latin file with the weight axis only. It writes the files into the export, so
they come from the app's own origin. It also generates fallback metrics, so the text
moves little when the font arrives. Both fonts use `font-display: swap`.

The Latin subset covers every Portuguese letter. A rare character outside it, in a
ballot name for example, shows in the fallback font.

Alternatives:

- `next/font/google` downloads from Google at build time. The files are not pinned, and
  the build then depends on Google being reachable.
- A Google Fonts stylesheet breaks the CSP, and it sends every visitor's address to
  Google before consent.
- Committing the font files works, but it puts binary files in the repository with no
  update path. The lockfile already pins the packages by their integrity hash.

Archivo's width axis is left out. The mockup's narrow headline is not worth a second
font file.

### 3. The headline comes from TSE's outcomes only

A pure function in `src/lib/headline.ts` takes a race's results and returns the first
form that applies, in this order:

| Form | When | Portuguese example |
|---|---|---|
| Count | A proportional race where TSE elected at least one candidate | "46 vagas de deputado federal preenchidas" |
| Seats | A proportional race where TSE elected no one | "Deputado federal: 46 vagas" |
| Runoff | A majoritarian race where a candidate's outcome is `2º turno` | "Flavio Bolsonaro e Lula vão ao 2º turno" |
| Elected | A majoritarian race where a candidate's outcome is an elected outcome | "Raquel Lyra vence no 1º turno" |
| Most voted | Any other majoritarian race | "Raquel Lyra teve mais votos" |

The proportional forms come first, because `isElected()` also matches "Eleito por QP".
For the Senate, the Elected form names both winners with a plural verb, for example
"Humberto Costa e Marília Arraes vencem para o Senado". A candidate page uses three more
forms: the candidate's own runoff or elected outcome, the place in the race, or TSE's
status for votes under appeal.

The function reads `isElected()` and `isInRunoff()`, which the outcome badges already
use. It never compares votes to decide an outcome. A unit test covers each form and the
order between them.

The summaries hold no gender for a candidate, and Portuguese marks gender in "eleito"
and "eleita". So every form uses a verb or a noun with no gender, as in the examples.
The Portuguese and English messages each take the names as parameters.

The dates of the two rounds, 2026-10-04 and 2026-10-25, are constants in
`src/lib/elections.ts`, next to the election codes. The header and the runoff cards
format them in the page's language.

### 4. The rank colors come from the maps' own ranking

The maps already pick the race's two most voted in its whole area. The cards, bars and
tiles call the same function in `src/lib/maps.ts`. For the President race on a state
page, that area is Brazil, so the function reads `getSummary('br')`. A unit test
renders a state where the second in Brazil led, and expects the second color.

### 5. The state tiles are a static grid with a text list

A constant holds each state's column and row, from the mockup, on a grid of 6 columns
and 8 rows. At 360 pixels, a tile is about 51 pixels wide. Each tile is a link whose
accessible name is the state, the leader and the share. Its fill comes from the maps'
`binOf()` and `SHADES`, so a tile shades exactly like a municipality with the same
margin. The text color is white on the darkest shade and `ink` on the others, which keeps
each pair above 4.5 to 1.

The list is an HTML table of state, most voted and share, inside a `<details>` element
under the grid. It is closed at every width, so the page does not grow by 27 rows and
needs no script or viewport rule to decide. Each row links to the state's President race
page, which keeps the link that the maps' text-equivalent requirement asks for.

### 6. The tabs enhance panels that the server renders in full

The server renders each race as a `<section>` with `id` set to the race's slug, for
example `senador`. Above the sections sits a list of links to `#governador`, `#senador`
and `#presidente`. This is the whole page without JavaScript. The Governor section holds
the Governor map, its municipality list and the closest municipalities. Each section
holds its own race's turnout, because turnout differs between races.

Three CSS rules decide which panel shows before any script runs:

- Under `@media (scripting: none)`, every panel shows.
- Under `@media (scripting: enabled)`, only the Governor panel shows.
- When a panel is the `:target`, it shows and the Governor panel hides. The rule uses
  `:has(:target)` on the panels' container.

The third rule makes a deep link to `#senador` paint the Senate panel first. It also
keeps the tab links working when JavaScript runs but the tabs' script fails to load.
`history.replaceState` does not move `:target`, so once the component runs, it marks the
container, and the three rules stop applying. From then on, the `hidden` attributes
alone decide which panel shows.

A small client component then:

- gives the list the roles `tablist` and `tab`, and each section the role `tabpanel`,
- selects the tab named by `location.hash`, or Governor,
- moves between tabs with the arrow keys, Home and End, and selects on focus,
- writes the selected tab's fragment with `history.replaceState`, so the back button
  does not step through tabs,
- marks the other panels `hidden="until-found"`, so the browser's find-in-page still
  reaches their text where the browser supports it,
- selects a panel's tab on its `beforematch` event, so a panel that find-in-page reveals
  is also the selected tab.

Alternatives:

- CSS-only tabs with `:target`. They give no tab semantics to a screen reader, and they
  show nothing when the address has no fragment. The design keeps `:target` as the
  fallback only.
- No CSS before the script, so every panel shows until hydration. The page then jumps
  on every load, by the height of two panels.
- An inline script in the head that reads the fragment before the first paint. It needs
  no `:has()`, but it adds a script outside React that the tests cannot reach.
- One page per tab. That adds 81 pages, and the race pages already exist.

### 7. Title case is one pure function, applied where names enter the views

`src/lib/names.ts` exports `displayName()`, which follows the rule in the spec. It
splits each word into segments at a hyphen, an apostrophe, a quote mark, a parenthesis,
a period or a slash, and applies the rule to each segment. It compares a segment
without its ordinal marks, so "DRª" counts as "DR". The lists of particles, titles and
acronyms are constants next to it.

The function applies to candidates' ballot names, to municipality names and to the
names of cities abroad. It runs where those names enter the views:

1. `raceResults()`, which builds every results table and card from a summary.
2. The candidate page, its title and its metadata.
3. The map labels, the municipality tables and the municipality lists.
4. In the browser, the search results and the drill-down views.

The search index keeps TSE's spelling, because matching already ignores case and
accents. Only the displayed result changes.

IBGE publishes municipality names in mixed case, but the boundary build keeps only the
IBGE code, and reading the names from IBGE would add a source to every page. TSE's names
with the same rule are close enough, and the review below covers every one of them.

Before the change merges, a task runs `displayName()` over every ballot name in the
pinned summaries, every municipality and every city abroad. On 2026-10-08, that was
18,505 distinct ballot names and 5,571 municipalities. The task attaches three lists to
the PR, and Luiz reviews them:

1. Each word that keeps its capitals.
2. Each recased word of four letters or fewer, where a missed acronym hides.
3. Each name that holds a period, a slash or a digit.

### 8. The new lists are computed at build time, and the tables stay small

- The closest municipalities come from the state's Governor rows in `getRaceMap()`,
  sorted by margin, with ties first.
- The largest municipalities come from the area's rows, sorted by valid votes. The
  candidate's share comes from `getCandidateVotes()`.
- A President candidate's share in each state comes from the 27 state summaries.

These add at most 27 table rows to a page. The state page gains two panels of cards, and
no map.

The restyled tables are the larger risk. The São Paulo state deputy page holds 1,346
candidates, and it sits at 92% of the size limit. Its class strings appear twice, in the
HTML and in the page's React payload. So the tables take their styles from a few
component classes in `globals.css`, such as one class for a results row, instead of a
string of utilities on every cell. The foundation PR measures that page with the new
classes before the other PRs start. If the page still exceeds the limit, the fix shortens
the table's markup. The limit does not move.

## Risks / Trade-offs

- [Title case mangles a name] → The rule changes only case. The three review lists in
  decision 7 cover the words where the rule is most likely to fail, and the sources page
  says that the names were recased.
- [Fonts slow the first visit] → Two Latin files with one axis each, and `swap`, so the
  text shows at once in the fallback. A task records their size in the PR.
- [The President card's color surprises a visitor] → On Pernambuco's page, Lula leads but
  takes the second color, because he came second in Brazil. The legend names the
  colors, and the color matches the President map one click away.
- [A hidden tab hides text from find-in-page] → `hidden="until-found"` and `beforematch`
  where the browser supports them, and every race keeps its own page with the full
  results.
- [`:has()` is missing in an old browser] → Every browser since 2023 supports it. In an
  older one, a deep link opens on the Governor tab until the script runs.
- [The deadline] → The work lands in three PRs, and the rule in the migration plan
  applies to each PR alone.
- [The browser tests break on the new structure] → Each PR updates the tests it breaks.
  No test is deleted without a replacement that covers the same requirement.

## Migration Plan

The change ships in three PRs, each one green in CI and deployed by Vercel on merge:

1. Tokens, fonts, the page shell and title case. Every page changes look, with no change
   to its structure.
2. The Brazil and state pages: headline, cards, state tiles, tabs and the closest
   municipalities.
3. The race and candidate pages, and the drill-down views' tables.

Each PR merges by 2026-10-23, or it waits until the runoff change merges. If PR 3 slips,
its requirements and tasks move to a follow-up change before the runoff change starts,
and this change archives after PR 2. The runoff change then builds on archived specs,
not on an open change.

A rollback is a revert of the PR. No data, address or Worker change is involved. No PR
of this change merges from 2026-10-24 to 2026-10-26.
