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
delivered HTML, so search engines and visitors without JavaScript see them. On a state
page, every race's panel SHALL be in the delivered HTML, including the panels of tabs
that are not selected. On the Brazil page, the state tiles and their text list SHALL be
in the delivered HTML.

#### Scenario: A state page without JavaScript
- **WHEN** a state page is loaded with JavaScript disabled
- **THEN** the leading candidates for that state's races and the turnout are readable

#### Scenario: A hidden tab in the delivered HTML
- **WHEN** a search engine reads a state page's HTML
- **THEN** the Senate and President panels hold their headlines and leading candidates, although the Governor tab is the one selected

#### Scenario: The state tiles without JavaScript
- **WHEN** the Brazil page is loaded with JavaScript disabled
- **THEN** the state tiles and the list of each state's most voted President candidate are readable

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

#### Scenario: The state tiles on a phone
- **WHEN** the Brazil page is opened at 360 pixels wide
- **THEN** the whole grid of state tiles fits the screen, and each tile is at least 44 pixels wide

#### Scenario: The race tabs on a phone
- **WHEN** a state page is opened at 360 pixels wide
- **THEN** every tab is reachable without horizontal scrolling of the page

### Requirement: Non-commercial
The app SHALL credit its author and link to the repository, and SHALL NOT promote any
product or service.

#### Scenario: Footer content
- **WHEN** any page is rendered
- **THEN** the footer holds the TSE credit, the author credit and the repository link, and nothing that sells a service

### Requirement: Each page leads with its result
The Brazil page, each state page, the votes-abroad page, each race page and each
candidate page SHALL open with its result, before any map or table. A headline SHALL
state TSE's outcome, and the app SHALL NOT call a candidate elected or in the runoff
unless TSE's outcome says so. The headline takes the first form that applies:

1. In a proportional race where TSE elected at least one candidate, it states how many.
   Where TSE elected no one, it states the race and its seats, with no count.
2. In a majoritarian race where TSE sends candidates to the runoff, it names them.
3. In a majoritarian race where TSE elected candidates, it names them. A Senate race with
   two elected names both.
4. Otherwise, it names the most voted candidate as the most voted.

A candidate page's headline states that candidate's own outcome from TSE. Without an
elected or runoff outcome, it states the candidate's place in the race instead. For a
candidacy whose votes TSE annulled sub judice, it states TSE's status.

Below the headline, cards SHALL show the leading candidates of a majoritarian race: the
top two for President and Governor, and for the Senate the candidates that TSE elected
plus the next most voted, never fewer than two. Each card SHALL show the ballot name, the party, the ballot
number, the share of valid votes, the votes and TSE's outcome, and SHALL link to the
candidate's page. A card for a candidate whom TSE sends to the runoff SHALL state the
runoff's date. A proportional race shows no cards. On the Brazil, votes-abroad and race
pages, the full results, the turnout and the map SHALL follow on the same page. The page
header SHALL name the round shown and its date, and SHALL link to the list of states on
the Brazil page.

#### Scenario: The Brazil page
- **WHEN** a visitor opens the Brazil page and TSE marks two President candidates for the runoff
- **THEN** the first heading names both as going to the runoff, and two cards show them before the map and the full results

#### Scenario: A Governor elected in the first round
- **WHEN** a visitor opens a state page where TSE marks one Governor candidate as elected
- **THEN** the headline names that candidate as elected

#### Scenario: A race with no outcome
- **WHEN** no candidate in a majoritarian race carries an elected or runoff outcome from TSE
- **THEN** the headline names the most voted candidate as the most voted, and calls no one elected

#### Scenario: A deputy race page
- **WHEN** a visitor opens a state's federal deputy race page
- **THEN** the headline states how many candidates TSE elected, and the page shows no candidate cards

#### Scenario: A deputy race with no one elected yet
- **WHEN** no candidate in a proportional race carries an elected outcome from TSE
- **THEN** the headline states the race and its seats, and no count of elected candidates

#### Scenario: The Senate
- **WHEN** a visitor opens a state's Senate results, where TSE elected two candidates
- **THEN** the headline names both elected candidates, and three cards show them and the next most voted

#### Scenario: A candidate page
- **WHEN** a visitor opens the page of a Governor candidate whom TSE marks as not elected
- **THEN** the headline states the candidate's place in the race, and calls the candidate neither elected nor in the runoff

#### Scenario: The runoff date
- **WHEN** a card shows a candidate whom TSE sends to the runoff
- **THEN** the card states that the runoff is on 25 October 2026, and the header names the first round and 4 October 2026

#### Scenario: The header's link to the states
- **WHEN** a visitor on a state page follows the header's link to the states
- **THEN** the Brazil page opens at its list of states

### Requirement: The states at a glance
The Brazil page SHALL show the 27 states as a grid of tiles, each placed at its rough
position on the map of Brazil. Each tile SHALL show the state's code and the share of
valid votes of its most voted President candidate. Each tile SHALL take that candidate's
map color, shaded by the same margin bins as the maps, and SHALL link to the state's
page. A legend SHALL name the colors and the bins, and the grid SHALL carry the TSE
credit. Under the grid, a list that opens on request SHALL name each state, its most
voted President candidate and that candidate's share, so the grid reads without color.
Each row of the list SHALL link to the state's President race page. A tile's accessible
name SHALL hold the same text as its row in the list.

#### Scenario: A state's tile
- **WHEN** the most voted President candidate in Pernambuco leads by more than 20 points
- **THEN** the PE tile shows the leader's share, takes the darkest shade of the leader's map color, and links to the Pernambuco page

#### Scenario: Reading the tiles without color
- **WHEN** a visitor cannot tell the tile colors apart and opens the list under the grid
- **THEN** the list names each state's most voted President candidate and share, and links each state to its President race page

### Requirement: A state page switches between its races
On a state page, the Governor, Senate and President races SHALL each be a tab. Each tab's
panel SHALL hold the race's headline, cards and turnout, and SHALL link to the race's own
page. The Governor panel SHALL also hold the Governor map, its list of municipalities and
the closest municipalities. The deputy races SHALL appear after the tabs as links to
their race pages, each with the count of candidates that TSE elected, when TSE elected
any, and with the race's most voted candidate. The page SHALL open on the Governor tab. When the address ends in a race's fragment,
for example `#senador`, the page SHALL open on that race's tab, and choosing a tab SHALL
set that fragment. The tabs SHALL work with a keyboard: the arrow keys move between tabs,
and a screen reader announces the tab list, the selected tab and its panel. Without
JavaScript, the page SHALL show every panel one after another, and each tab SHALL be a
link to its panel. When JavaScript runs but the tabs' script fails, choosing a tab SHALL
still show its panel. The votes-abroad page has one race and shows no tabs.

#### Scenario: Opening the Senate tab from a link
- **WHEN** a visitor opens a state page whose address ends in `#senador`
- **THEN** the Senate tab is selected and its panel shows

#### Scenario: Moving between tabs with the keyboard
- **WHEN** a keyboard user focuses the Governor tab and presses the right arrow
- **THEN** the Senate tab is selected and its panel shows

#### Scenario: A state page without JavaScript
- **WHEN** a state page is loaded with JavaScript disabled
- **THEN** the Governor, Senate and President panels all show, one after another

#### Scenario: The tabs' script fails
- **WHEN** JavaScript runs, the tabs' script fails to load, and a visitor chooses the Senate tab
- **THEN** the Senate panel shows

#### Scenario: The Federal District
- **WHEN** a visitor opens the Federal District's page
- **THEN** the deputy links offer federal deputy and district deputy, and no state deputy

#### Scenario: The votes-abroad page
- **WHEN** a visitor opens the votes-abroad page
- **THEN** it opens with the President headline and two cards, and shows no tabs

### Requirement: Names in title case
The app SHALL show candidates' ballot names, municipality names and the names of cities
abroad in title case: each word starts with a capital letter and continues in lower
case. The Portuguese particles "da", "das", "de", "do", "dos" and "e" SHALL stay in
lower case unless they start the name, and so SHALL a "d" before an apostrophe, as in
"Pau d'Arco". A word with no vowel, such as PT or BH, SHALL keep its capitals, except
the abbreviated titles CMDT, DR, JR, PR, SGT and SR, which take title case. The vowels are
A, E, I, O, U and Y, with or without an accent. A Roman numeral of two letters or more,
written with I, V and X, such as II or XV, SHALL keep its capitals. An acronym that
holds a vowel SHALL keep its capitals when it is on a written list, which holds at least
PCO, PSOL, PSTU, CUT, ONG, SAMU and COHAB. Every other word takes title case, a party
name that is also a common word, such as NOVO, included. A letter after any character
that is neither a letter nor a digit, such as a hyphen, an apostrophe, a quote mark, a
parenthesis, a period or a slash, SHALL start in capitals. So a particle right after
such a character, as in "(DO POVO)", starts in capitals too.

The rule SHALL apply wherever one of these names appears, page titles, maps and search
results included. The app SHALL change only the case, never a letter, an accent or the
word order. The sources page SHALL say that TSE publishes these names in capitals and
that the site shows them in title case. Search SHALL find a name whatever the case of
the typed text.

#### Scenario: A two-word name
- **WHEN** TSE's ballot name is "FLAVIO BOLSONARO"
- **THEN** the site shows "Flavio Bolsonaro"

#### Scenario: A name with a particle
- **WHEN** TSE's ballot name is "MARIA DA SILVA"
- **THEN** the site shows "Maria da Silva"

#### Scenario: A name with a party abbreviation
- **WHEN** TSE's ballot names are "ZE DO PT", "BIA DO PSOL" and "LU DO NOVO"
- **THEN** the site shows "Ze do PT", "Bia do PSOL" and "Lu do Novo"

#### Scenario: An acronym with a vowel
- **WHEN** TSE's ballot name is "ZE DA ONG"
- **THEN** the site shows "Ze da ONG"

#### Scenario: An abbreviated title
- **WHEN** TSE's ballot names are "DR. ANA LIMA", "DR.ANA LIMA" and "PR. ANA LIMA"
- **THEN** the site shows "Dr. Ana Lima", "Dr.Ana Lima" and "Pr. Ana Lima"

#### Scenario: A Roman numeral
- **WHEN** TSE's municipality names are "PEDRO II" and "PIO IX"
- **THEN** the site shows "Pedro II" and "Pio IX"

#### Scenario: Two words joined by a slash
- **WHEN** TSE's ballot name is "LU ENFERMEIRA/PROFESSORA"
- **THEN** the site shows "Lu Enfermeira/Professora"

#### Scenario: Municipality names
- **WHEN** TSE's municipality names are "ABREU E LIMA" and "PAU D'ARCO"
- **THEN** the site shows "Abreu e Lima" and "Pau d'Arco"

#### Scenario: Searching in capitals
- **WHEN** a visitor types "FLAVIO" in the search box
- **THEN** the results include Flavio Bolsonaro's candidacy

### Requirement: Fonts from the app's own origin
The app SHALL serve its fonts from its own origin, from font files that its build
includes. No page SHALL request a font or a stylesheet from any other host. While a font
loads, or when it fails to load, the text SHALL show in a system font.

#### Scenario: Loading a page under the production headers
- **WHEN** a visitor opens any page with the production headers applied
- **THEN** the browser requests no font or stylesheet from another host, and reports no security-policy violation

#### Scenario: A font fails to load
- **WHEN** a font file cannot be downloaded
- **THEN** the page shows its text in a system font
