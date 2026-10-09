## Context

See `proposal.md` for the motivation, and the delta spec for the requirements.

`RaceMap` is a client component. It receives a map's `MapData` as props, draws the map
once its boundary file arrives and checks out, and renders the list of municipalities
from the same props. Next.js renders that list into the HTML, and serializes the props
into the page's inline payload and into each navigation file. So a page holds a map's
values twice in its HTML: as the list, and as the props.

Measured on the live site on 2026-10-09:

| Page | HTML | List | Inline props |
|---|---|---|---|
| `/2026/presidente/13/` | 1,085,589 B | 755,661 B | 316,683 B |
| `/2026/` | 395,608 B | none | 358,597 B |
| `/2026/sp/governador/` | 185,580 B | 115,729 B | 60,424 B |

A server-rendered table does not help. On `/2026/sp/deputado-federal/`, the full results
table is server-rendered: its 327 kB of HTML come with 776 kB of inline payload, because
the payload describes every element of the table.

The export writes four files for each page: `index.html`, `index.txt`, `__next._full.txt`,
which has the same bytes as `index.txt`, and a `__PAGE__` segment file of nearly the same
size. A test on the fixture build recorded every payload request: loading a page and
hovering its links requests none, because `AppLink` never prefetches, and each client
navigation requests the target's `index.txt` only.

## Goals / Non-Goals

**Goals:**

- The Brazil pages and the candidate pages drop their map values from the HTML and the
  navigation files.
- Each map that loads its values still checks them against a pin before it draws.
- The page size gate still sees every byte that a page needs.
- The build stores one navigation file per page.

**Non-Goals:**

- No change to a state or race page, whose list is the text equivalent that a visitor
  without JavaScript reads.
- No change to the schema between the pipeline and the app. The values files reuse the
  JSON shapes that `.data/` already holds.

## Decisions

### 1. Which maps load their values from a file

The President map of each round's Brazil page, and every candidate page's share map, load
from a file. The state and race maps keep their values in the page.

The Brazil maps have no list, so their props are pure overhead. A candidate page's list is
the heaviest part of the heaviest pages. A state or race page must deliver its list in the
HTML. Its client list needs the values as props to stay sortable and filterable, and a
server-rendered list would cost more in the payload than the props do, as the deputy page
shows.

Alternative for the candidate pages, which Luiz rejected on 2026-10-09: keep every list in
the HTML, prune the navigation files, and trim each row's markup. A finalist's page holds
two lists and two sets of props, about 2 × (755 + 317) kB, or 2.14 MB. Trimming each row by
about a fifth takes the lists from 755 to about 604 kB each, which leaves the page near
1.8 MB. A phone downloads all of it to read the headline, and the swing map's third list
crosses the gate.

Alternative for every map: load from a file, and server-render the state and race lists.
That grows those pages' payload, and loses the sorting until a second copy arrives.

### 2. One values file per race, area and round

A share map reads its race's `-votos.json` for its area and round, the file that
`buildMaps` already writes with every candidate's votes by municipality. The browser then
builds the candidate's `MapData` with `shareMap()`, which the server uses today. All the
candidates of a race, in both languages, read the same file, so a visitor who opens a
second candidate's page reads it from the cache.

The Brazil maps read `mapas/br/1.json` of their round, the `MapData` that the page passes
as props today.

Estimated from the live list's rows: Brazil's round-1 President votes file holds 5,570
rows of about 95 bytes, about 530 kB before compression, and its round-2 file, with two
candidates, about 300 kB. Task 4.1 records the real sizes.

Alternative: one file per candidate. That stores 2 to 12 copies of each race's
municipality names and valid votes, one per candidate, and caches nothing across pages.

### 3. Where the files live, and how the browser checks them

`prepare-data.ts` writes each values file, with the municipality names already in title
case, to `public/mapas/t<round>/<area>/<name>.<sha16>.json`. Both the name and the pin come
from the SHA-256 of the final bytes, as the search index's name does, so a change to the
title case gives the file a new name. It records each file's address and full SHA-256 for
the pages. `vercel.json` caches `/mapas/` for good, as it caches `/busca/`. A fixtures
build writes the same files from the fixtures.

```ts
// The props of a map that loads from a file. The legend needs no row, so the page draws
// its frame, title, steps and credits before the file arrives.
type MapSource =
  | { kind: 'inline'; data: MapData }
  | { kind: 'file'; url: string; sha256: string; frame: Omit<MapData, 'rows'>; share?: Share }
```

The map requests its values file when the page loads, and its boundary file when it nears
the viewport, as it does today. It checks the values file's SHA-256 with `crypto.subtle`,
as it checks the boundary file, and draws when both check out.

The check keeps one rule for every file that a map reads. A file that a browser caches for
a year can hold a truncated or altered body, and the check stops the map from drawing it.

### 4. A candidate page's list

`RaceMap` renders a candidate page's list from the values, as soon as the values file
checks out, whether or not the boundary file has arrived. The list sits folded in a
`<details>` element, whose summary names the count of municipalities. The build knows that
count, so the summary is in the HTML and the page does not move when the rows arrive.
Because the file loads with the page, the rows are in the page before a visitor scrolls,
so find-in-page and a screen reader reach them.

Without JavaScript, a `<noscript>` note says that the map and its list need JavaScript.
The page's server-rendered stats, six largest municipalities and state shares stay as they
are.

A candidacy whose votes are under appeal has no column in its race's file. The build
already reads the file for the six largest municipalities, so it decides: such a page
renders no share map and no list, and requests no values file, as today.

### 5. A values file that fails

If the file does not arrive, or its SHA-256 differs, the map shows neither colors nor a
list, says that its values failed to load, and offers a retry. The retry requests the file
with `cache: 'reload'`, so it never reads the cached copy that failed.

If the file answers 404, the page comes from an earlier deployment, because a new data
version or a new build renames the files. The map then says that the site was updated, and
offers to reload the page.

A boundary file that fails keeps today's behavior: no map, and the list stays.

### 6. Pruning the navigation files

`scripts/prune-payloads.ts` runs after `next build` and before the page size gate. It
deletes each page's `__next._full.txt`, `__next._tree.txt` and `__next.*.__PAGE__.txt`,
and keeps `index.txt`. A browser test follows a link on each kind of page and fails on any
payload request that gets a 404.

Alternative: a `next.config.ts` option. Task 1.1 checks Next 16's options first, and
uses one if it exists for a static export.

### 7. The page size gate counts the values files

`scripts/page-size.ts` reads each page's values file addresses from its HTML, and adds
those files' sizes to the page's. A page fails when the sum exceeds 2.5 MB, and the gate
names the page, its HTML's size and each file's size. A President finalist's page counts
its HTML and both rounds' values files, about 60 kB plus 530 kB plus 300 kB.

Alternative: a separate limit on each values file. A page that loads two files then passes
both limits while it is still too heavy, which is what the gate exists to stop.

## Risks / Trade-offs

- [A later Next.js release, or a link that prefetches, requests a deleted file] → The
  router falls back to a full page load, so navigation still works, and the browser test
  catches the 404 in CI.
- [A President candidate's page downloads every candidate's votes] → About 530 kB before
  compression, against today's 1.08 MB page, and the browser caches it for every other
  President candidate's page.
- [A candidate's share by municipality needs JavaScript on every page] → Accepted by Luiz
  on 2026-10-09. A race page's list shows each municipality's most voted and margin, not
  one candidate's share, and the Brazil page has no list. Without JavaScript, the
  candidate page keeps its six largest municipalities and, for President, every state.
- [Search engines index less of a candidate page] → Accepted under D2: the state and race
  lists stay in the HTML.
- [A tab opened before a deploy requests a file that the deploy renamed] → The map offers
  to reload the page, which brings the new names.

## Migration Plan

One web PR, merged by 2026-10-16, so that it runs in production for a week before the
freeze. It needs no new data version, because every values file derives from the pinned
versions. Its PR records the export's size, the largest page, the Brazil pages, Lula's
page and the largest values file, before and after. If it misses 2026-10-23, it waits
until the round-2 pin and its live checks are done. Reverting it restores the props.
