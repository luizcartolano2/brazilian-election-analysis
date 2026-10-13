## 1. Catalog and file list

- [ ] 1.1 Write `web/src/lib/playground/catalog.json` with the tables of design decision 4: each table's manifest path patterns, its added columns, and each column's name, type and meaning in Portuguese and English, with each vote type code in the meaning of `tipo`. Test that every table and column has both languages, that no table shares a name with any column, and that each pattern matches files in the fixture manifests of both rounds
- [ ] 1.2 In `web/scripts/prepare-data.ts`, derive the playground's file list from the pinned manifests: each file that a catalog pattern matches, with its path, size, SHA-256, round, race and area. Write it with the build's other derived files. Test the list for the fixture manifests, and that a manifest file that no pattern matches, such as an invented file of estimates, stays out of it

## 2. Pipeline contract

- [ ] 2.1 Add a pipeline test that builds the fixtures and compares each output Parquet file's column names and types with `web/src/lib/playground/catalog.json`, and fails with the file and the column when they differ. Test it on a copy of an output file with a renamed column, and on one with an extra column

## 3. Engine

- [ ] 3.1 Add `web/src/lib/playground/engine.ts`, which starts an engine as design decision 2 orders it: the Parquet extension from the Worker, the registered files, `memory_limit`, `allowed_paths`, `enable_external_access` off and `lock_configuration` on. Before each run it drops every table and view that it did not create, recreates its views, and compares each file's `DESCRIBE` with the catalog. Add a browser test for each refusal in the spec: another data version's file, another site's CSV, a statement that turns file access back on, `COPY ... TO`, `ATTACH`, `INSTALL` and `LOAD`. Make sure that the browser sends no request for a refused URL, and that a table created in one run is gone in the next
- [ ] 3.2 Add the downloads of design decision 1: fetch each needed file whole from the pinned version, check it against its SHA-256, keep its bytes for the visit, and drop the bytes that a new data choice no longer needs. Show each table's size for the choice, and ask before a run that needs more than 25 MB of new files. Test a file whose bytes differ, which shows the error and the retry with no rows, the size of a choice, and the question before a large download, which requests nothing until the visitor confirms
- [ ] 3.3 Add the scan of design decision 3 in `web/src/lib/playground/tables.ts`. Test names inside string literals and comments, quoted names, names in any case, a column that shares a prefix with a table, and a query that names no table
- [ ] 3.4 Run queries with `send()`: keep the first 1,000 rows for the table and up to 1,000,000 for the CSV, stop and cancel past that, and print integers exactly. Make a cancel call `cancelSent()`, and terminate the engine's Worker if the query has not stopped two seconds later. Add browser tests: a cancelled query that takes minutes to run, which stops within two seconds and leaves the next run working, a result of more than 1,000,000 rows, which states that size while the page answers to typing, and a query over the memory limit, which shows the engine's error

## 4. Form and examples

- [ ] 4.1 Add the form's templates of design decision 6 in `web/src/lib/playground/form.ts`, for the four questions and the four levels. Test that each generated query names its table, and that no typed text reaches it. Add browser tests on the fixtures: one candidate's votes by municipality in Acre, which equal each municipality's page, and turnout by state for Brazil, which equals each state's page
- [ ] 4.2 Add the example queries, each with its data choice and a title and a description in both languages: turnout by state, a President candidate's votes and share by municipality, a party's votes for federal deputy by state, blank and null votes by municipality for Governor, the municipalities with the highest abstention, and a municipality's polling places. Add a browser test that runs each example on the fixtures and gets rows and no error. Add a unit test that fails when an example's title or description, in either language, holds a word of suspicion, fraud, anomaly, projection or transfer

## 5. Frame, CSV and link

- [ ] 5.1 Draw the result frame of design decision 8: the query above the table, and the table's caption with the statement about a visitor's query, each data version with its round, and the TSE credit line. Test that the caption sits inside the table element, and that a query of invented numbers shows the caption and the query
- [ ] 5.2 Add the CSV writer of design decision 9 in `web/src/lib/playground/csv.ts`. Test the byte order mark, the comment lines, a query on four lines, RFC 4180 quoting, a text cell for each of `=`, `+`, `-`, `@`, a tab and a carriage return, a negative number with no prefix, and the file's name for one and for both rounds. Add a browser test that downloads a result and reads its lines, and one that refuses a result of more than 1,000,000 rows and links to the sources page
- [ ] 5.3 Add the link of design decision 10 in `web/src/lib/playground/link.ts`. Test a round trip, a state code with a slash, a race the election lacks, a round that is not pinned, a query over 10,000 characters, text that is not URL-safe base64 or not JSON, and a link that names an earlier data version. Add a browser test that opens a link, finds the query and the choice restored, and sees no Parquet request and no run until the visitor runs it

## 6. Page

- [ ] 6.1 Add the pages at `web/app/(pt)/2026/consultas/` and `web/app/en/2026/consultas/` with the layout of design decision 12: the data choice, the form and editor tabs, the examples, the tables panel, the run and cancel button with its progress, Ctrl+Enter and Cmd+Enter, and the question before text that the visitor typed is replaced. Link the page from the sources page. Add browser tests: opening the page requests no Parquet file and no engine file, the `<noscript>` text links to the sources page, every control is reachable at 360 pixels wide while a wide result scrolls inside its frame, and the page runs a query under the production headers with no security-policy violation
- [ ] 6.2 Add the playground's messages to `web/messages/pt.json` and `en.json`, including the sentence that introduces an engine error and the note on importing the CSV into a spreadsheet. Make sure that the test of both languages passes

## 7. Documentation

- [ ] 7.1 Update `web/README.md`: the playground, the catalog as the contract with the pipeline, the engine's limits and the spike that showed them, the 25 MB question, and the CSV's format
