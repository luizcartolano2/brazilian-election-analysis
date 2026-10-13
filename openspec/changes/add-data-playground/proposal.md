## Why

The site shows fixed views. A visitor with any other question must download the Parquet
files and run DuckDB on their own computer. Issue 26 asks for a page where a visitor asks
that question in the browser, against the same pinned data, and downloads the answer.

Most of the site's audience does not write SQL. On 2026-10-13, Luiz asked for both a form
that builds a query and a raw SQL editor. He also chose to credit TSE in comment lines at
the top of each downloaded CSV.

## What Changes

- A playground page at `/2026/consultas/`, and at `/en/2026/consultas/` in English. The
  sources page links to it. It loads the query engine only when the visitor first runs a
  query.
- The visitor first chooses the data: one or both pinned rounds, one or more races, and
  Brazil or chosen states. Each table lists its size for that choice, from the pinned
  manifest. A run downloads only the files of the tables that its query names. A run that
  needs more than 25 MB of new files waits for the visitor to confirm.
- A form builds a query from fixed choices: a question, a level, a candidate, an order and
  a row count. It writes the query into the editor, where the visitor reads and changes it
  before running it. Its shares of valid votes equal the results pages' shares.
- A SQL editor runs the visitor's own statements over the playground's tables. A side
  panel lists each table and each column's meaning. Example queries fill the editor.
- The engine reads only files that the page downloaded from the pinned versions and
  checked against the manifest's SHA-256. It refuses any other file or URL, any write, a
  database file, any extension and any change to its own configuration. A spike on the
  bundled DuckDB 1.5.4 showed that its settings can enforce this.
- Each run starts on a fresh database, so a macro, a table or an attached database that
  a visitor's run creates never outlives that run.
- Queries run in the engine's Web Worker. The page shows progress, a cancel button that
  stops a query within two seconds, and at most the first 1,000 rows of a result.
- Each result sits in a frame. Its table caption says that a visitor's query produced it,
  names each data version with its round, and carries the TSE credit. The frame also shows
  the query.
- The whole result, up to 1,000,000 rows, downloads as CSV. The file starts with comment
  lines that hold the TSE credit, the data versions and the link that restores the query.
  A header or text cell that starts like a formula is written so that a spreadsheet reads
  it as text.
- A link holds the query, the data choice and the data versions in the address's
  fragment, so the query never reaches a server. The link restores the query and does not
  run it.
- A catalog lists each table and column that the playground exposes, with its meaning in
  both languages. A pipeline test fails when the published columns and the catalog differ,
  and the page refuses a file whose columns differ.
- The results explorer keeps its rule that no visitor value reaches a query except as a
  bound parameter. The playground's editor is the rule's one exception.
- The new text ships in Portuguese and English.

## Capabilities

### New Capabilities

- `data-playground`: a page where a visitor queries the pinned official data in the
  browser, through a form or their own SQL. Its engine reads only the pinned files, and
  each result downloads with its credit.

### Modified Capabilities

- `results-explorer`: "Addresses accept only valid values" names the playground's editor
  as the one place where a visitor's SQL runs. A playground link's data choice passes the
  same checks as an address.

## Invariants

This change touches these invariants in `CLAUDE.md`, and it keeps each one as follows:

- An estimate is never a count. The catalog and the examples hold no estimate. The
  catalog names only files of official counts, so a later file of estimates stays out
  until a change adds it with its range and its label. No example states a combination
  of races as a count of people.
- No integrity claims. No example scores or ranks a polling station or a machine as
  suspicious, and none projects a runoff.
- A visitor's own query can compute any figure, a cross-race count or a station score
  included. Its caption says that a visitor's query produced it, so the site states
  nothing in it. This change adds that reading to D17, which governs what the site
  states, and to the Invariants in `CLAUDE.md`. The two invariants above keep holding for
  everything that the site authors.
- Before 2026-10-25, estimates stay behind their flag. The change adds no estimate, and
  its code merges after the round-2 pin.
- Official numbers reconcile, or nothing publishes. The playground reads only published
  files, which passed the pipeline's checks, and it writes nothing.
- Only GitHub Actions publishes data. The change adds no publish path.
- At run time the app reads only pinned data. The engine reads only files from the pinned
  versions, through the Worker, each checked against its manifest. The page also reads a
  file list that the build derives from the pinned manifests and serves from the app's
  origin.
- TSE gets credit wherever its data appears. The caption of every result and the comment
  lines of every CSV carry the credit line from `DATA_LICENSE.md`.
- Every user-facing string exists in Portuguese and English. The page, the form, the
  catalog's descriptions and the examples ship in both. Table and column names stay as
  the data names them. An error from the engine shows a sentence in the visitor's
  language, and then the engine's own message as it wrote it, in English.
- The app stays non-commercial. The page credits the author like every other page.
- Analytics loads only after consent. The change adds no analytics. The query stays in
  the fragment, which never reaches a server.
- Candidates' personal identifiers never leave the pipeline. The playground exposes only
  the catalog's columns. The pipeline already refuses to write an identifier, and the new
  contract test keeps the catalog equal to the published columns.

The change extends D7, because the browser now runs the visitor's queries too. It keeps
D9's request limit, because each file costs one request per visit. It keeps D17's "no
saved views", because a link stores nothing on a server. D17 gains the sentence that puts
a visitor's own query outside its rules. D14 gains its timing.

## Non-goals

- No saved queries on a server, no accounts, and no query history.
- No data from other elections.
- No estimate in any table.
- No charts of a result. A result is a table and a CSV.
- No syntax highlighting or completion in the editor, which stays a text box.
- No Parquet or JSON download of a result.
- No boundary files in the playground.
- No change to the pipeline's outputs, the data versions or the Worker.

## Impact

- `web/app/(pt)/2026/consultas/` and `web/app/en/2026/consultas/`: the page.
- `web/src/lib/drilldown/browser.ts`: export the stall guard `instantiate`, which the
  playground reuses.
- `web/src/lib/playground/`: the catalog, the engine's start and limits, the scan of a
  query's tables, the form's queries, the CSV writer and the link's format.
- `web/src/components/playground/`: the data choice, the form, the editor, the tables
  panel, the examples and the result frame.
- `web/src/views/sources-view.tsx`: the link to the playground.
- `web/scripts/prepare-data.ts`: the playground's file list, derived from the pinned
  manifests.
- `web/messages/pt.json` and `en.json`: the new messages.
- `pipeline/tests/`: the contract test between the published columns and the catalog.
- `web/e2e/`: browser tests of the page, the engine's limits, the CSV and the link.
- `web/README.md`: the playground and its limits.
- `docs/decisions.md`: D14 records this change's timing, and D17 puts a visitor's own
  query outside its rules.
- `CLAUDE.md`: the Invariants say the same as D17.
