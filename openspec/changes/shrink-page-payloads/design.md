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

- The Brazil page and the candidate pages drop their map values from the HTML and the
  navigation files.
- Each map that loads its values still checks them against a pin before it draws.
- The build stores one navigation file per page.

**Non-Goals:**

- No change to a state or race page, whose list is the text equivalent that a visitor
  without JavaScript reads.
- No change to the schema between the pipeline and the app. The values files reuse the
  JSON shapes that `.data/` already holds.

## Decisions

### 1. Which maps load their values from a file

The Brazil page's President map and every candidate page's share map load from a file.
The state and race maps keep their values in the page.

The Brazil map has no list, so its props are pure overhead. A candidate page's list is the
heaviest part of the heaviest pages, and the spec now lets it come with the map. A state
or race page must deliver its list in the HTML. Its client list needs the values as props
to stay sortable and filterable, and a server-rendered list would cost more in the payload
than the props do, as the deputy page shows.

Alternative: every map loads from a file, and state and race lists are server-rendered.
That grows those pages' payload, and loses the sorting until a second copy arrives.

### 2. One values file per race, area and round

A share map reads its race's `-votos.json` for its area and round, the file that
`buildMaps` already writes with every candidate's votes by municipality. The browser then
builds the candidate's `MapData` with `shareMap()`, which the server uses today. All the
candidates of a race, in both languages, read the same file, so a visitor who opens a
second candidate's page reads it from the cache.

The Brazil map reads `mapas/br/1.json`, the `MapData` that the page passes as props today.

Alternative: one file per candidate. That stores 2 to 12 copies of each race's
municipality names and valid votes, one per candidate, and caches nothing across pages.

### 3. Where the files live, and how the browser checks them

`prepare-data.ts` copies each values file from `.data/rounds/<round>/mapas/` to
`public/mapas/t<round>/<area>/<name>.<sha16>.json`, with the municipality names already
in title case. It records each file's address and full SHA-256 for the pages, as it does
for the search index. `vercel.json` caches `/mapas/` for good, as it caches `/busca/`. A
fixtures build writes the same files from the fixtures.

```ts
// The props of a map that loads from a file. The legend needs no value, so the page draws
// its frame, title, steps and credits before the file arrives.
type MapSource =
  | { kind: 'inline'; data: MapData }
  | { kind: 'file'; url: string; sha256: string; frame: Omit<MapData, 'rows'>; share?: Share }
```

The map starts both downloads when it nears the viewport, as the boundary download does
today. It checks the values file's SHA-256 with `crypto.subtle`, as it checks the boundary
file, and draws only when both files check out.

### 4. A candidate page's list

`RaceMap` renders the list from the values, so a candidate page's list appears with its
map. While the file loads, the list's place says that it is loading. Without JavaScript, a
`<noscript>` note says that the map and its list need JavaScript. The page's server-
rendered stats, six largest municipalities and state shares stay as they are.

### 5. A values file that fails

If the file does not arrive, or its SHA-256 differs, the map shows neither colors nor a
list, says that its values failed to load, and offers a retry, which downloads again. A
boundary file that fails keeps today's behavior: no map, and the list stays.

### 6. Pruning the navigation files

`scripts/prune-payloads.ts` runs after `next build` and before the page size gate. It
deletes each page's `__next._full.txt`, `__next._tree.txt` and `__next.*.__PAGE__.txt`,
and keeps `index.txt`. A browser test follows a link on each kind of page and fails on any
payload request that gets a 404.

Alternative: a `next.config.ts` option. Task 1.1 checks Next 16's options first, and
uses one if it exists for a static export.

## Risks / Trade-offs

- [A later Next.js release, or a link that prefetches, requests a deleted file] → The
  router falls back to a full page load, so navigation still works, and the browser test
  catches the 404 in CI.
- [A President candidate's page downloads every candidate's votes] → The file is about
  as large as one candidate's list is in today's HTML, the server compresses it, and the
  browser caches it for every other candidate's page.
- [A visitor without JavaScript loses a candidate's full list] → Accepted. The race page
  of the candidate's area still lists every municipality, and the candidate page keeps its
  six largest municipalities and, for President, every state.
- [Search engines index less of a candidate page] → Accepted under D2: the state and race
  lists stay in the HTML.
- [The list appears after the page loads] → The map already reserves its height while its
  boundary loads, and the list follows it.

## Migration Plan

One web PR, merged by 2026-10-23. It needs no new data version, because every values file
derives from the pinned versions. Its PR records the export's size, the largest page, the
Brazil page and Lula's page, before and after. Reverting it restores the props.
