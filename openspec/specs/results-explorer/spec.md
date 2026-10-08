# results-explorer Specification

## Purpose

Lets anyone explore the official first-round results of the 2026 election, in
Portuguese or English, from Brazil as a whole down to a single polling station, with
every number traceable to TSE.

## Requirements

### Requirement: Portuguese first, English in step
The app SHALL serve Portuguese at the root and English under `/en`, with the same pages
in both. Every user-facing string SHALL exist in both languages. Numbers SHALL use each
language's format.

#### Scenario: Switching language keeps the place
- **WHEN** a visitor on a state page switches language
- **THEN** they land on the same state page in the other language

#### Scenario: Number format
- **WHEN** a share of 47.027% is shown
- **THEN** the Portuguese page shows `47,03%` and the English page shows `47.03%`

#### Scenario: A missing translation
- **WHEN** a string exists in one language's messages but not the other's
- **THEN** the test suite fails

### Requirement: Results for every race at every level
For a chosen race and area, the app SHALL show the candidates' votes and shares of valid
votes, ordered by votes, together with blank votes, null votes, technical nulls,
attendance and abstention. It SHALL also show annulled and annulled sub judice votes
whenever they are not zero, as TSE does. Levels are Brazil, state, municipality, zone and
polling station. President is available at every level, including votes cast abroad.
Governor, Senate and the deputy races are available from the state level down. The
Federal District shows its district deputy race in place of a state deputy race.
Fernando de Noronha also shows its Conselheiro Distrital race, from the municipality
level down. In the deputy races, the page SHALL also show each party's list votes and its
total of candidate and list votes, so every vote counted in the valid-vote denominator
is visible. At the Brazil and state levels, and abroad, the list SHALL hold every
candidate in the race. In a municipality, zone or polling station, it SHALL hold every
candidate with at least one vote there, and the page SHALL say that the others are left
out.

#### Scenario: Governor in one municipality
- **WHEN** a visitor opens the governor race for a municipality
- **THEN** they see each candidate's votes and share, blank, null, technical nulls, attendance and abstention for that municipality

#### Scenario: A candidate with no votes in a polling station
- **WHEN** a visitor opens a polling station where a candidate in the race received no votes
- **THEN** that candidate is not listed, and the page says that only candidates with votes there are listed

#### Scenario: Two senate seats
- **WHEN** a visitor opens the senate race
- **THEN** the page states that each voter chose two candidates, and shares are of all valid votes in the race

#### Scenario: The Federal District's races
- **WHEN** a visitor opens the Federal District
- **THEN** the race list offers district deputy and no state deputy race

#### Scenario: The Conselheiro Distrital race
- **WHEN** a visitor opens Fernando de Noronha
- **THEN** the Conselheiro Distrital race is offered, and the page states that it fills seven seats with one choice per voter

#### Scenario: Party-list votes in a deputy race
- **WHEN** a visitor opens a deputy race for a state
- **THEN** each party's list votes and its party total appear, and candidate votes plus list votes equal the valid votes shown

#### Scenario: Votes under appeal
- **WHEN** a race in an area has votes that TSE classifies as annulled sub judice
- **THEN** the page shows them on their own line, apart from valid votes

#### Scenario: A race that does not exist at that level
- **WHEN** a visitor opens the governor race for Brazil as a whole
- **THEN** the app offers the state list instead of empty results

### Requirement: Official outcome per candidate
The app SHALL show each candidate's outcome as TSE publishes it, such as elected, in the
runoff or not elected. It SHALL NOT compute seat allocation or outcomes itself.

#### Scenario: A runoff candidate
- **WHEN** the presidential results for Brazil are shown
- **THEN** each candidate whom TSE lists for the runoff is marked as in the runoff

### Requirement: Drill down with shareable addresses
From any area, the app SHALL link to each area one level down. Every view SHALL have its
own address, so a link opens the same race and area.

#### Scenario: Sharing a polling station
- **WHEN** a visitor copies the address of a polling station's page and opens it elsewhere
- **THEN** the same station and race are shown

### Requirement: Addresses accept only valid values
The app SHALL accept a state code only from the 27 states and `zz`, a race only from the
races of the election, and municipality, zone and station numbers only as whole numbers
within their ranges. For any other value it SHALL show the error state. No value from the
address or from the search box SHALL reach a query or a file path except as a validated
value passed as a bound parameter.

#### Scenario: A query injected in the address
- **WHEN** a visitor opens a station address whose municipality value contains SQL text
- **THEN** the page shows the error state and runs no query

#### Scenario: A path in the state code
- **WHEN** a visitor opens an address whose state code contains a slash or `..`
- **THEN** the page shows the error state and requests no file

#### Scenario: Quotes in the search box
- **WHEN** a visitor searches for a place name that contains quote characters
- **THEN** the search treats them as text and returns matching places or none

### Requirement: Headline numbers without JavaScript
The pages for Brazil and for each state SHALL contain their headline results in the
delivered HTML, so search engines and visitors without JavaScript see them.

#### Scenario: A state page without JavaScript
- **WHEN** a state page is loaded with JavaScript disabled
- **THEN** the leading candidates for that state's races and the turnout are readable

### Requirement: Find your polling station
The app SHALL let a visitor find a polling station by choosing a municipality and typing
part of the polling place's name or address.

#### Scenario: Searching by place name
- **WHEN** a visitor chooses a municipality and types part of a school's name
- **THEN** matching polling places are listed with their address and stations, each linking to its station page

### Requirement: Aggregated stations explain themselves
When a visitor opens a polling station that TSE aggregated onto another, the app SHALL
explain that its votes are counted in the principal station, and link to it.

#### Scenario: Opening an aggregated station
- **WHEN** a visitor opens an aggregated station
- **THEN** the page explains the aggregation and links to the principal station, and shows no results of its own

### Requirement: Every number traces to its source
Every page SHALL credit TSE. A sources page SHALL list each TSE source, its license, the
data version in use, and a link to that version's manifest. It SHALL also list the map
boundaries: IBGE's edition, IBGE's terms, that this project simplified them, and the
boundary build in use with a link to its manifest. A polling station's page SHALL link to
TSE's own page for that station.

#### Scenario: Checking a station against TSE
- **WHEN** a visitor on a polling station's page follows the link to TSE
- **THEN** TSE's results site opens on the same station

#### Scenario: The data version is visible
- **WHEN** a visitor opens the sources page
- **THEN** it shows the pinned data version and links to its manifest

#### Scenario: The boundaries are visible
- **WHEN** a visitor opens the sources page
- **THEN** it names IBGE's 2025 municipal boundaries, their terms, that they were simplified, and the boundary build in use with a link to its manifest

### Requirement: One pinned and verified data version
The app SHALL be built against one data version, named together with the SHA-256 of its
manifest. The build SHALL fail when that manifest is missing, when its checksum differs,
or when any summary file it reads differs from the manifest. At run time the app SHALL
read data only from that version and from its pinned boundary build, both through the
Worker, and from files that the build derived from that version and serves from the
app's own origin.

#### Scenario: A newer version exists
- **WHEN** a newer data version is published but the app is not rebuilt with it
- **THEN** the app keeps showing the pinned version

#### Scenario: The pinned version has no manifest
- **WHEN** the app is built against a version whose manifest is missing
- **THEN** the build fails

#### Scenario: A tampered summary
- **WHEN** a summary file's SHA-256 differs from the pinned manifest's entry
- **THEN** the build fails

#### Scenario: The search index
- **WHEN** a visitor focuses the search box
- **THEN** the index comes from the app's own origin, and the build derived it from the pinned version's summaries

### Requirement: Works under its own security policy
Every page SHALL load, and every query SHALL run, under the production security headers.
The browser SHALL be allowed to fetch data only from the app's own origin and the Worker.

#### Scenario: A station view with the production headers
- **WHEN** a polling station view is opened with JavaScript enabled and the production headers applied
- **THEN** the results appear and the browser reports no security-policy violation

### Requirement: No partial numbers on failure
If data cannot be loaded, the app SHALL say so in the visitor's language and SHALL NOT show
a partial result as if it were complete.

#### Scenario: The data host is unreachable
- **WHEN** a polling-station query fails
- **THEN** the page shows an error message and offers a retry, with no numbers for that view

#### Scenario: The query engine fails to download
- **WHEN** the download of the query engine's module or its Parquet extension fails
- **THEN** the view shows the error message and the retry, and does not stay on its loading message

### Requirement: Usable on a phone
Every page SHALL work at 360 pixels wide without horizontal scrolling, and every number
shown in a chart SHALL also be available as text.

#### Scenario: A results table on a phone
- **WHEN** a results view is opened at 360 pixels wide
- **THEN** all candidates, votes and shares are readable without horizontal scrolling

### Requirement: Non-commercial
The app SHALL credit its author and link to the repository, and SHALL NOT promote any
product or service.

#### Scenario: Footer content
- **WHEN** any page is rendered
- **THEN** the footer holds the TSE credit, the author credit and the repository link, and nothing that sells a service
