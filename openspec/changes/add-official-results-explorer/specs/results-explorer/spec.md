## Purpose

Lets anyone explore the official first-round results of the 2026 election, in
Portuguese or English, from Brazil as a whole down to a single polling station, with
every number traceable to TSE.

## ADDED Requirements

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
For a chosen race and area, the app SHALL show every candidate's votes and share of valid
votes, ordered by votes, together with blank votes, null votes, technical nulls,
attendance and abstention. Levels are Brazil, state, municipality, zone and polling
station. President is available at every level, including votes cast abroad. Governor,
Senate and the deputy races are available from the state level down. The Federal District
shows its district deputy race in place of a state deputy race.

#### Scenario: Governor in one municipality
- **WHEN** a visitor opens the governor race for a municipality
- **THEN** they see each candidate's votes and share, blank, null, technical nulls, attendance and abstention for that municipality

#### Scenario: Two senate seats
- **WHEN** a visitor opens the senate race
- **THEN** the page states that each voter chose two candidates, and shares are of all valid votes in the race

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
data version in use, and a link to that version's manifest. A polling station's page SHALL
link to TSE's own page for that station.

#### Scenario: Checking a station against TSE
- **WHEN** a visitor on a polling station's page follows the link to TSE
- **THEN** TSE's results site opens on the same station

#### Scenario: The data version is visible
- **WHEN** a visitor opens the sources page
- **THEN** it shows the pinned data version and links to its manifest

### Requirement: One pinned data version
The app SHALL read data only from the single data version it is built with, and only
through the Worker.

#### Scenario: A newer version exists
- **WHEN** a newer data version is published but the app is not rebuilt with it
- **THEN** the app keeps showing the pinned version

### Requirement: No partial numbers on failure
If data cannot be loaded, the app SHALL say so in the visitor's language and SHALL NOT show
a partial result as if it were complete.

#### Scenario: The data host is unreachable
- **WHEN** a polling-station query fails
- **THEN** the page shows an error message and offers a retry, with no numbers for that view

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
