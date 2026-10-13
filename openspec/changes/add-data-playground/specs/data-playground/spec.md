## Purpose

Lets a visitor ask their own questions of the pinned official results in the browser,
through a form or their own SQL, and download each answer with TSE's credit.

## ADDED Requirements

### Requirement: A playground page
The app SHALL have a playground page at `/2026/consultas/`, and at `/en/2026/consultas/`
in English, and the sources page SHALL link to it. The page SHALL download no data file
and no part of the query engine until the visitor first runs a query. Without
JavaScript, the page SHALL say that the playground needs it, and link to the sources
page.

#### Scenario: Opening the playground
- **WHEN** a visitor opens the playground
- **THEN** the page shows the data choice, the form, the editor, the tables and the examples, and requests no Parquet file and no engine file

#### Scenario: Without JavaScript
- **WHEN** a visitor opens the playground with JavaScript turned off
- **THEN** the page says that the playground needs JavaScript, and links to the sources page, which lists the published files

#### Scenario: On a phone
- **WHEN** a visitor opens the playground at 360 pixels wide and runs a query whose result has twelve columns
- **THEN** every control is reachable without horizontal scrolling of the page, and the result scrolls sideways inside its own frame

### Requirement: The visitor chooses the data first
The page SHALL let the visitor choose one or both pinned rounds, one or more races, and
either Brazil or chosen states. Brazil holds every state and the votes cast abroad. The
playground's tables SHALL hold only the chosen data. The tables panel SHALL show each
table's size for the choice, from the pinned manifests. A run SHALL download only the
files of the tables that its query names. A run that needs more than 25 MB of files that
the visit has not yet downloaded SHALL wait until the visitor confirms that size.

#### Scenario: Only round 1 is pinned
- **WHEN** a visitor opens the playground while no round-2 version is pinned
- **THEN** the data choice offers round 1 only

#### Scenario: A query that names one table
- **WHEN** a visitor chooses round 1, the President race and Brazil, and runs a query that names only the municipality totals
- **THEN** the run downloads only the President's municipality totals, one file for each state and one for the votes abroad

#### Scenario: A large download asks first
- **WHEN** a visitor runs a query over the station votes of both deputy races for Brazil
- **THEN** the page states the size of the download, and requests no file until the visitor confirms

#### Scenario: Both rounds
- **WHEN** a visitor chooses both rounds and the President race
- **THEN** each table holds a column for the round, and holds round 1's rows from round 1's version and round 2's rows from round 2's version

#### Scenario: Turnout for one race
- **WHEN** a visitor chooses the President race and Acre, and sums the eligible voters of the municipality turnout
- **THEN** the sum equals Acre's eligible voters for President, counting each voter once

#### Scenario: President candidates for a state
- **WHEN** a visitor chooses the President race and Acre
- **THEN** the candidates table holds the President's candidates

### Requirement: Only described, official columns
The page SHALL list each table with each column's name, type and meaning in the
visitor's language. The playground SHALL expose only the tables and columns that its
catalog describes, from files of official counts. When a pinned file's columns differ
from the catalog's, the run SHALL fail, name the table and the column, and show no rows.

#### Scenario: A column the catalog does not describe
- **WHEN** a pinned file holds a column that the catalog does not describe
- **THEN** a run that needs the file fails, names the table and the column, and shows no rows

#### Scenario: A file the catalog does not name
- **WHEN** a pinned version holds a file that the catalog names for no table, such as a file of estimates
- **THEN** no table of the playground reads it

#### Scenario: The vote types
- **WHEN** a visitor reads the columns of a table of votes
- **THEN** the vote type column lists the meaning of each of its codes, from candidate to annulled sub judice

### Requirement: A form for visitors who do not write SQL
The page SHALL offer a form that builds a query from fixed choices: a question, a level,
a candidate when the question needs one, an order and a number of rows. The questions
SHALL be each candidate's votes, one candidate's votes, turnout, and blank and null
votes. The levels SHALL be state, municipality, zone and polling station. The form
SHALL write its query into the editor, where the visitor can read and change it before
running it. A share of valid votes that the form computes SHALL count valid votes as the
results pages count them.

#### Scenario: One candidate by municipality
- **WHEN** a visitor uses the form for one candidate's votes, in round 1's President race in Acre, by municipality
- **THEN** each row names a municipality of Acre, with the candidate's votes and share of valid votes, which equal that municipality's page

#### Scenario: Turnout by state
- **WHEN** a visitor uses the form for turnout in round 1's President race for Brazil, by state
- **THEN** each row's eligible voters, attendance and abstentions equal that state's page

#### Scenario: A race the choice does not hold
- **WHEN** the data choice holds several races
- **THEN** the form offers only those races, and builds its query over one of them

#### Scenario: A share that ends in five
- **WHEN** a candidate has 41 of a municipality's 4,000 valid votes
- **THEN** the form's share is 1.03, as the municipality's page prints 1,03%

#### Scenario: Both rounds by municipality
- **WHEN** a visitor uses the form for a candidate's votes by municipality, with both rounds chosen
- **THEN** each municipality appears once for each round, with that round's votes

### Requirement: An editor for the visitor's own SQL
The page SHALL offer an editor that runs the visitor's SQL over the playground's tables,
when the visitor presses the run button or Ctrl+Enter, or Cmd+Enter on a Mac. The page
SHALL show the result of the run's last statement. Each run SHALL start from the
playground's tables alone, so its result depends only on its query and its data
versions. Before the form or an example replaces text that the visitor typed, the page
SHALL ask.

#### Scenario: An error in the query
- **WHEN** a visitor runs a query with a syntax error
- **THEN** the page shows no rows, a sentence in the visitor's language, and the engine's own message as the engine wrote it

#### Scenario: A run that replaced a table
- **WHEN** one run replaces the table of station votes with invented rows, and the next run reads that table
- **THEN** the next run reads the pinned station votes

#### Scenario: A table from an earlier run
- **WHEN** one run creates a table, and the next run reads it
- **THEN** the next run fails, because the table no longer exists

#### Scenario: A macro from an earlier run
- **WHEN** one run creates a macro named `round`, a table macro named `read_parquet`, a schema on the search path and an attached in-memory database, and the next run uses the form
- **THEN** the next run returns the pinned numbers, as a fresh visit does

#### Scenario: Typed text is kept
- **WHEN** a visitor typed a query, and then chooses an example
- **THEN** the page asks before it replaces the typed query, and keeps it if the visitor declines

### Requirement: The engine reads only the pinned, checked files
The page SHALL run every query in an engine that reads only the files that the page
downloaded. The page SHALL download them from the pinned versions through the Worker, and
check each against the manifest's SHA-256. The engine SHALL refuse any statement that
reads another file or a URL, writes a file, attaches a database file, loads an extension,
or changes the engine's configuration. These limits SHALL hold in addition to the
security policy's limits on the hosts that the page can fetch from.

#### Scenario: A query that reads another data version
- **WHEN** a visitor runs a query that reads a Parquet file of another data version from the Worker's URL
- **THEN** the engine refuses it, and the browser sends no request for that file

#### Scenario: A query that reads another site
- **WHEN** a visitor runs a query that reads a CSV file from another site's URL
- **THEN** the engine refuses it, and the browser sends no request to that site

#### Scenario: A query that lifts the limits
- **WHEN** a visitor runs a statement that turns the engine's access to files back on, and then a query that reads a URL
- **THEN** the engine refuses both statements

#### Scenario: A query that writes a file
- **WHEN** a visitor runs a statement that copies a result to a file
- **THEN** the engine refuses it, and every table still reads the pinned data

#### Scenario: A query that attaches a database file
- **WHEN** a visitor runs a statement that attaches a database file
- **THEN** the engine refuses it, and the browser sends no request for that file

#### Scenario: A file that fails its check
- **WHEN** a file that a run downloads differs from its SHA-256 in the pinned manifest
- **THEN** the run shows an error and a retry, and no rows

### Requirement: A heavy query does not freeze the page
Queries SHALL run off the page's main thread. While a query runs, the page SHALL show its
progress and a cancel button, and a cancel SHALL stop the query within two seconds. The
page SHALL show at most the first 1,000 rows of a result. It SHALL state how many rows
the result holds, or that it holds more than 1,000,000.

#### Scenario: Cancelling a long query
- **WHEN** a visitor cancels a query that takes minutes to run
- **THEN** within two seconds the page says that the query was cancelled, shows no rows, and runs the next query normally

#### Scenario: A result with millions of rows
- **WHEN** a visitor runs a query that returns more than 1,000,000 rows, such as every polling station's President votes in Brazil
- **THEN** the page shows the first 1,000 rows, states that the result holds more than 1,000,000 rows, and answers to typing and scrolling throughout the run

#### Scenario: A query that needs too much memory
- **WHEN** a query needs more memory than the engine's limit
- **THEN** the page shows the engine's error and no rows, and the tab keeps working

### Requirement: Every result carries its frame
Each result SHALL sit in a frame that shows the query's text. The result table's caption
SHALL state that a visitor's query produced the result from TSE's official data. It SHALL
also name each data version that the run read, with its round, and carry the TSE credit
line. The caption SHALL be part of the table, so a capture of the table alone keeps it.

#### Scenario: A cropped capture
- **WHEN** someone captures only the result table
- **THEN** the capture shows that a visitor's query produced it, the data version and the TSE credit

#### Scenario: A query of invented numbers
- **WHEN** a query selects a candidate's name and a number of votes that it invents
- **THEN** the caption says that a visitor's query produced the result, and the frame shows the query that invented them

### Requirement: The result downloads as CSV with its credit
The page SHALL let the visitor download the whole result as CSV when it holds at most
1,000,000 rows. It SHALL refuse the download, rather than truncate the file, when it
holds more. The file SHALL start with lines that begin with `#`. They SHALL hold the TSE
credit line, each data version with its round, and the playground link that restores the
query. Every header or text cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage
return SHALL be written so that a spreadsheet reads it as text. No line of the file SHALL
hold a cell that a spreadsheet runs as a formula. The file's name SHALL name each round
and data version.

#### Scenario: The credit travels with the file
- **WHEN** a visitor downloads a result
- **THEN** the file's first lines hold the TSE credit, the data version and the link that restores the query, each line starting with `#`, and then the header and the rows

#### Scenario: A query that hides a formula
- **WHEN** a query from a link holds `,=HYPERLINK("https://example.org")` in a comment, and names a column `=1+1`
- **THEN** the file's comment lines hold the link and not the query's text, and the header cell starts with a single quote

#### Scenario: A cell that looks like a formula
- **WHEN** a result cell holds text that starts with `=`
- **THEN** the CSV cell starts with a single quote, so a spreadsheet shows the text and runs no formula

#### Scenario: A result over the limit
- **WHEN** a visitor asks to download a result of more than 1,000,000 rows
- **THEN** the page writes no file, says why, and links to the sources page, which lists the Parquet files

### Requirement: A link that holds the query
The page SHALL offer a link that holds the query, the data choice and each data version
in the address's fragment, so the query never reaches a server. Opening the link SHALL
restore the query and the data choice, and SHALL NOT run the query until the visitor
runs it. The page SHALL accept a link's data choice only from the pinned rounds, the
election's races and the 27 states and `zz`. When a link names a data version that is no
longer pinned, the page SHALL say so and name both versions.

#### Scenario: Opening a shared link
- **WHEN** a visitor opens a link to the playground that holds a query
- **THEN** the editor holds the query and the data choice is restored, and the page downloads nothing and runs nothing until the visitor runs it

#### Scenario: A link from an earlier version
- **WHEN** a visitor opens a link that names an earlier round-1 version than the pinned one
- **THEN** the page names both versions, and states that a run reads the pinned version

#### Scenario: A link with an invalid data choice
- **WHEN** a link's data choice holds a state code with a slash, or a race the election does not have
- **THEN** the page says that the link is invalid, restores no part of it, and requests no file

### Requirement: Example queries
The page SHALL offer example queries, each with a title and a description in the
visitor's language. Choosing an example SHALL set its data choice and its query. Each
example SHALL run without error on the pinned data. No example SHALL score or rank a
polling station or a machine as suspicious, project a runoff, or state a combination of
races as a count of people.

#### Scenario: Every example runs
- **WHEN** CI runs each example in the browser on the fixture data
- **THEN** each one returns rows and no error
