## Context

See `proposal.md` for the motivation, and the delta specs for the requirements.

The drill-down views already run DuckDB-WASM in the browser:

- `web/src/lib/drilldown/browser.ts:13-28` keeps one engine per page, and `start` at
  lines 59-93 runs it in a Web Worker, from the module and the Parquet extension that the
  Worker serves. It turns extension autoloading off and loads the Parquet extension from
  the Worker. Its `instantiate` at lines 30-57 fails a module download that stalls,
  because DuckDB's worker drops a failed download without rejecting.
- `web/src/lib/drilldown/queries.ts:14-20` runs fixed SQL text, and passes every value,
  file URLs included, as a bound parameter.
- `web/src/lib/drilldown/files.ts:4-21` names each published table's path inside a data
  version.
- `web/vercel.json:23` limits `connect-src` to the app's origin and the Worker, and
  `worker-src` to the app's origin and `blob:`.
- `web/src/components/race-map.tsx:234` caches the maps' checked JSON files by address
  and SHA-256.

Each manifest's `arquivos` lists every file with its path, size and SHA-256. The pinned
round-1 version, `20261007-67d59ff-37656362427`, holds 126.4 MB of Parquet in 525 files:

| Files | Count | Size |
|---|---|---|
| `t1/votos/cargo=<c>/uf=<UF>` | 137 | 95.7 MB |
| `t1/comparecimento/uf=<UF>` | 28 | 11.2 MB |
| `t1/secoes/uf=<UF>` | 28 | 8.2 MB |
| `t1/totais/zona/cargo=<c>/uf=<UF>` | 137 | 5.7 MB |
| `t1/totais/municipio/cargo=<c>/uf=<UF>` | 137 | 4.6 MB |
| `t1/totais/zona/comparecimento/uf=<UF>` | 28 | 0.4 MB |
| `t1/totais/municipio/comparecimento/uf=<UF>` | 28 | 0.3 MB |
| `t1/candidatos` | 1 | 0.2 MB |
| `municipios` | 1 | 0.1 MB |

The President's station votes for Brazil are 4.9 MB. The largest file, São Paulo's
station votes for state deputy, is 12.2 MB. All of São Paulo's files are 32.5 MB.

The vote type codes are 1 candidate, 2 party list, 3 blank, 4 null, 5 technical null, 6
annulled and 7 annulled sub judice (`web/src/lib/drilldown/model.ts:38-46`). The results
pages count types 1 and 2 as valid votes (`web/src/lib/results.ts:134-141`).

A spike on 2026-10-13 ran the installed `@duckdb/duckdb-wasm` 1.33.1-dev57.0, which
bundles DuckDB 1.5.4, under Node with registered in-memory files. After the settings in
decision 2:

- A query read an allowed file, and a view created earlier still read it.
- A query refused a registered file outside the allowed list, a path with `..`, an
  `https` URL and `glob('/*')`, each with a permission error.
- `SET enable_external_access`, `SET allowed_directories`, `SET lock_configuration` and
  `RESET lock_configuration` each failed: "the configuration has been locked".
- `COPY ... TO` an allowed path failed, because it writes a temporary file first.
- `LOAD json` failed.

The lock does not cover a visitor's catalog and session state. The design and security
reviews found, and a second spike confirmed, that these still work after the lock:

- `CREATE MACRO` and `CREATE TEMP MACRO`, which can shadow a built-in. After
  `CREATE TEMP MACRO round(x, d) AS 99`, `round(2.345, 2)` returned 99. A temporary table
  macro named `read_csv` took over the page's own `CREATE OR REPLACE VIEW` over
  `read_csv`, and the view returned the macro's rows.
- `CREATE TABLE`, `CREATE VIEW`, `CREATE SCHEMA`, `CREATE TYPE`, `SET search_path` and
  `USE`.
- `ATTACH ':memory:'`, which reads no file, and `INSTALL json`, whose `LOAD` still fails.

A fresh `db.open()` on the same engine, followed by the setup of decision 2, removed every
macro and every attached database, and restored the lock. The files that the engine had
registered before were still there.

`AsyncDuckDB.registerFileBuffer` transfers the page's `ArrayBuffer` to the engine's
Worker, which leaves the page's copy empty. `send(text, allowStreamResult)` streams a
result only when its second argument is true.

## Goals / Non-Goals

**Goals:**

- A visitor's SQL can read only the pinned, checked bytes, and the page enforces this
  inside the engine, not only in the security policy.
- The page knows every byte that it downloads before it downloads it.
- A result's caption carries everything that a cropped capture needs.
- The form's numbers equal the results pages' numbers.

**Non-Goals:**

- No new published file. The playground reads the files that exist.
- The playground starts its own engine. The drill-down engine changes only to export its
  stall guard, `instantiate`, which the playground reuses.

## Decisions

### 1. The page downloads whole files and checks them

For each file that a run needs, the page fetches the whole file from the pinned version
through the Worker. It checks the file against the SHA-256 in the pinned manifest, and
hands the bytes to the engine as a registered in-memory file. The engine itself makes no
request. The page keeps no copy, because the registration moves the bytes into the
engine. The tab therefore holds each file once, and the whole round takes about 126 MB.

This gives the page three things. Every byte that a query reads matches the manifest.
The page knows a run's size in advance, from the manifest's sizes. Each file costs one
Worker request per visit, and the browser's cache serves a later visit, because the
Worker marks versions as immutable.

Alternative: let DuckDB read byte ranges over HTTP, as the drill-down views do. A
selective query reads less that way. But the page can then neither check the bytes nor
bound the requests. A scan of the whole round costs one request per column chunk, against
the Worker's 100,000 daily requests (D9).

### 2. A fresh, locked database for each run

The engine starts once, with `instantiate` from `browser.ts`, so a stalled module
download fails as it does on the drill-down views. Each downloaded file is registered
once, under a fixed name such as `/consultas/t1/votos/cargo=1/uf=AC.parquet`. A file that
a new data choice no longer needs is dropped from the engine.

Before every run, the page opens a fresh in-memory database on the engine, and sets it up
in this order, before any statement of the visitor's:

1. Load the Parquet extension from the Worker, as `browser.ts` does.
2. Create the playground's views over the registered files (decision 4).
3. Compare each file's `DESCRIBE` with the catalog (decision 5).
4. Set `memory_limit` to 1 GB, so a heavy query fails with an error before the tab runs
   out of memory. The limit counts DuckDB's own memory, not the registered files, which
   the engine's heap holds apart. With the whole round, the two stay under 1.2 GB, within
   the 4 GB that WebAssembly can address.
5. Set `allowed_paths` to exactly the registered names that the views read, then
   `enable_external_access` to false, then `lock_configuration` to true.

The page's own statements run before the visitor's, on a database where no macro of the
visitor's exists yet. So a macro cannot take over a view or the catalog check. A fresh
database drops every macro, schema, type, table, attached database and search path that a
visitor created. Each run therefore starts from the playground's tables alone, so a
link's result depends only on its query and its data versions. Within a run, a visitor's
statement can still replace a view, or select numbers that it invents. Those numbers
reach a caption that says that a visitor's query produced them (decision 8).

Alternative: drop, before each run, every object that the page did not create. The
reviews showed that the list of such objects is long and grows with DuckDB, and a missed
one, such as a macro named `round`, falsifies the next run. Opening a database costs less
than a list that must stay complete.

### 3. A run downloads only the tables that its query names

Before a run, the page scans the query's text for table names. The scan skips string
literals and comments, compares names without case, and accepts a quoted name. A
false match only downloads one table too many. The form and the examples name their
tables in their own text, so the same scan serves them.

Alternative: ask DuckDB's parser through `json_serialize_sql`. It handles only `SELECT`
statements, and it needs a started engine before the page can show a size.

### 4. The tables

Each table is a view over the chosen files, with the columns that the files hold plus
the ones the page knows from the file's path. The page reads each file with
`hive_partitioning = false`, so a column from the path never appears twice. No table
shares a name with a column, so the scan of decision 3 never takes a column for a table.
With a table named `votos`, every sum of the `votos` column downloads the station
votes.

DuckDB refuses a bound parameter in `CREATE VIEW`, so each view's text names its files.
The page takes every name from the build's file list (decision 11), never from the link
or from typed text.

| Table | Files per round | Added columns |
|---|---|---|
| `votos_secao` | `votos/cargo=<c>/uf=<UF>` | `turno`, `uf`, `cargo` |
| `comparecimento_secao` | `comparecimento/uf=<UF>`, rows of the chosen races | `turno`, `uf` |
| `votos_municipio` | `totais/municipio/cargo=<c>/uf=<UF>` | `turno`, `uf`, `cargo` |
| `comparecimento_municipio` | `totais/municipio/comparecimento/uf=<UF>`, rows of the chosen races | `turno`, `uf` |
| `votos_zona` | `totais/zona/cargo=<c>/uf=<UF>` | `turno`, `uf`, `cargo` |
| `comparecimento_zona` | `totais/zona/comparecimento/uf=<UF>`, rows of the chosen races | `turno`, `uf` |
| `secoes` | `secoes/uf=<UF>` | `turno`, `uf` |
| `candidatos` | `candidatos.parquet`, rows of the chosen races and areas | none |
| `municipios` | round 1's `municipios.parquet` only | none |

A table whose files a pinned round lacks holds no rows from that round.

Each turnout file holds one row per race for every place, because the pipeline writes the
totals by race. The three turnout tables therefore keep only the chosen races, or a sum of
eligible voters counts each voter once per race.

The pipeline writes the President's candidates once, under `uf = 'BR'`. So `candidatos`
keeps the President's rows whenever the choice holds the President, whatever its areas.

Each round's version carries its own `municipios.parquet`. The table reads round 1's only,
because round 1 is always pinned. A union of both files repeats every municipality, and a
join on it doubles every count.

### 5. The catalog is the contract

`web/src/lib/playground/catalog.json` lists each table, the manifest paths that feed it,
and each column's name, type and meaning in Portuguese and English. It is the only list
of what the playground exposes.

Two checks keep it true. A pipeline test builds the fixtures and compares each output
file's columns with the catalog, so a schema change fails CI until the same PR updates
the catalog. In the browser, the page compares each registered file's `DESCRIBE` with
the catalog before the visitor's statement runs. A new published file, such as a file of
estimates, stays outside the playground until a change adds it to the catalog.

### 6. The form writes fixed SQL

Each question and level maps to a fixed template. The page fills a template only with
codes from fixed lists and with whole numbers, such as a candidate's number from
`candidatos`. No typed text enters the form's SQL.

- The levels read the smallest table that answers them. The state and municipality
  levels read `votos_municipio` or `comparecimento_municipio`, the zone level reads the
  zone totals, and the station level reads `votos_secao` or `comparecimento_secao`.
- The municipality level joins `municipios` for the name.
- Valid votes are the votes of types 1 and 2. The share is
  `((votos::BIGINT * 20000 + validos) // (2 * validos)) / 100`, which rounds half up in
  whole numbers, as `formatShare` prints it. `round(100.0 * votos / validos, 2)` rounds
  in floating point. On the pinned round 1, it differs from the page on 3 of 1,925,187
  rows, for example 41 of 4,000 votes, which the page prints as 1,03% and `round` gives
  as 1.02. The cast keeps `votos * 20000` from overflowing the `INTEGER` column.
- The blank and null question reports blank, null, technical-null and annulled votes,
  each with its share of the votes cast.

### 7. Results stream, and a cancel has a fallback

The page runs a query with `send(text, true)`, so the engine streams the result, and it
reads the Arrow batches as they come. It keeps the first 1,000 rows for the table and up
to 1,000,000 rows for the CSV. When a result passes 1,000,000 rows, the page stops
reading, cancels the query and states the limit. Integers stay exact: the engine returns
`BIGINT` values as `bigint`, and the table prints them as text.

A cancel calls `cancelSent()`. If the query has not stopped one second later, the page
terminates the engine's Worker, so the page shows the cancel within the two seconds that
the spec allows. The terminated engine takes its registered files with it. The next run
starts a new engine and fetches its files again. The browser's cache serves them, because
the Worker marks versions as immutable, and the page checks each SHA-256 again.

### 8. The frame and its caption

The frame shows the query in a read-only block above the table. The table's own
`<caption>` holds three lines: "Resultado de uma consulta de visitante sobre dados
oficiais do TSE", each data version with its round, and the credit line from
`DATA_LICENSE.md`. The caption sits inside the table's border, so a capture of the table
keeps it.

### 9. The CSV file

The file is UTF-8 with a byte order mark, so a spreadsheet reads the accents. Fields are
separated by commas, decimals use a dot, and text follows RFC 4180 quoting. The comment
lines come first, each starting with `# `: the credit line, one line per data version,
and the playground link of decision 10, which restores the query. Every header and text
cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading
single quote, as OWASP advises against formula injection. Numbers are never prefixed.
The name reads `consulta-2026-t1-20261007-67d59ff-37656362427.csv`, with each chosen
round.

A comment line carries the link, not the query's text. A spreadsheet knows no comment
lines, so it splits a `#` line at each separator, and a query from a link is untrusted.
A query line such as `SELECT 1 -- ,=HYPERLINK("https://example.org")` puts a live
formula in the line's second cell. The link holds only letters, digits and `-_:/.#=`, so
it never splits. The page writes only its own fixed text in the other comment lines.

Luiz chose comment lines that hold the query. The reviews found the formula above, so
the line holds the link that restores the query.

Alternative: semicolons and decimal commas on the Portuguese page, which Excel in Brazil
opens without an import step. But the file then depends on the page's language, and
DuckDB and pandas need options to read it. One format serves every tool.

### 10. The link

The fragment reads `#c=<payload>`, where the payload is URL-safe base64 of a JSON object:
a format version, each round's data version, the data choice and the query. The browser
never sends a fragment to a server. The page parses the payload as untrusted input. It
accepts only a pinned round, a race of the election, an area among the 27 states and
`zz`, and a query of at most 10,000 characters. On any failure the page restores nothing.
Opening a link never starts a download or a run.

### 11. The file list comes from the build

`web/scripts/prepare-data.ts` derives the playground's file list from the pinned
manifests: each catalog path with its size and SHA-256, for each round. It writes the
list with the build's other derived files, served from the app's origin. The page reads
the list when it opens, and the Worker serves the files. The engine's module and its
Parquet extension come from the Worker, as `browser.ts` loads them.

### 12. The page

The page follows the site's shell and colors. On a wide screen the tables panel sits
beside the query. On a phone everything stacks, and the tables panel folds.

```
+----------------------------------------------------------------+
| Consultas                                                      |
| Faça suas próprias perguntas aos dados oficiais do TSE.        |
+----------------------------------------------------------------+
| Dados   [1º turno v]  [Presidente v]  [Brasil v]               |
+-------------------------------------------+--------------------+
| [Montar consulta] [Escrever SQL]          | Tabelas            |
| [Exemplos v]                              | votos_municipio    |
| Pergunta   [Votos de um candidato   v]    |   1,0 MB           |
| Candidato  [13 LULA                 v]    |   municipio  int   |
| Nível      [Município               v]    |   tipo       cód.  |
| Ordem      [Mais votos primeiro     v]    |   ...              |
| Linhas     [100                     v]    | votos_secao        |
|                                           |   4,9 MB           |
| SELECT m.nome, sum(v.votos) AS votos ...  |   ...              |
| [Executar]  Ctrl+Enter                    |                    |
+-------------------------------------------+--------------------+
| SELECT m.nome, sum(v.votos) AS votos ...         [Copiar link] |
| +------------------------------------------------------------+ |
| | Resultado de uma consulta de visitante sobre dados         | |
| | oficiais do TSE. 1º turno: versão 20261007-67d59ff-...     | |
| | Fonte: Tribunal Superior Eleitoral (TSE), ...              | |
| |------------------------------------------------------------| |
| | nome           | votos     | percentual_validos            | |
| | Rio Branco     | 123.456   | 52,31                         | |
| +------------------------------------------------------------+ |
| 100 linhas                                       [Baixar CSV]  |
+----------------------------------------------------------------+
```

- The form tab shows its SQL read-only below it. "Escrever SQL" opens the same text in
  the editor, where the visitor can change it.
- The editor is a `textarea` in the site's monospace font, with no new dependency.
  Ctrl+Enter or Cmd+Enter runs it.
- While a run downloads, the run button becomes "Cancelar", and the page shows the bytes
  received over the bytes needed. While the query runs, it shows the elapsed seconds.
- A run that needs more than 25 MB of new files shows the size, with "Baixar e executar"
  and "Voltar".
- Numbers in the table use the visitor's language's separators. The CSV keeps raw values.

### 13. Timing

The proposal can merge at any time. The code merges after the round-2 pin and its live
checks, outside the freeze of 2026-10-24 to 2026-10-26, so the pin PR never changes two
things at once (D14).

## Risks / Trade-offs

- [A visit that downloads the whole round holds 126 MB in the engine, and a phone can
  run out of memory] → The page asks before 25 MB of new files, keeps no second copy, and
  drops from the engine the files that a new choice no longer needs.
- [Visitors exhaust the Worker's 100,000 daily requests, which the rest of the site
  needs] → Each file costs one request per visit, and the whole round is 525 requests.
  The browser's cache serves repeat visits.
- [A capture shows numbers that a visitor invented, on the site's page] → The caption
  says that a visitor's query produced them, and the frame shows the query. The page
  cannot stop a capture that crops the caption, as with any other screenshot.
- [A DuckDB-WASM update changes how the locked settings behave] → The browser tests of
  each refusal in the spec run on every PR, in the real engine.
- [A pipeline change adds or renames a column] → The pipeline's contract test fails
  until the catalog changes in the same PR. A version published before the catalog
  changes makes the page refuse the file, with an error that names the column.
- [The engine's messages are in English on the Portuguese page] → The page introduces
  each one with a sentence in the visitor's language, and quotes the message as written.
- [Excel in Brazil opens a comma-separated file in one column] → The page's text next to
  the download says how to import it. The trade-off is in decision 9.
- [A visitor's query runs on a phone for minutes] → The cancel works on any query, and a
  stalled engine is terminated.

## Migration Plan

Nothing migrates. The page is new, and a revert removes it.
