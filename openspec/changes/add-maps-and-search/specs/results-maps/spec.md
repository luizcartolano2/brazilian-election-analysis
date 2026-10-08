## Purpose

Shows where each candidate led and how strongly, by municipality, on the Brazil, state,
race and candidate pages, with every color also readable as text.

## ADDED Requirements

### Requirement: Maps on the Brazil, state and race pages
The Brazil page SHALL map the President race by municipality. Each state page SHALL map
its Governor race by municipality, and each race page SHALL map its own race. A page
whose area has only one municipality, such as the Federal District, SHALL show no map.
Votes cast abroad SHALL NOT appear on any map. The Brazil map SHALL link to the abroad
page instead.

#### Scenario: The Brazil page
- **WHEN** a visitor opens the Brazil page
- **THEN** a map shows the President race for every municipality in Brazil, and a link leads to the votes cast abroad

#### Scenario: A state's race page
- **WHEN** a visitor opens the Senate race page for a state
- **THEN** a map shows that state's municipalities colored for the Senate race

#### Scenario: The Federal District
- **WHEN** a visitor opens the Federal District's page
- **THEN** no map is shown, because the district has one municipality

### Requirement: Colors show the most voted, shaded by margin
In a race for President, Governor, Senate or Conselheiro Distrital, each municipality
SHALL take the color of its most voted candidate. In a deputy race, it SHALL take the
color of the party with the most votes, counting the party's valid candidate votes and
its list votes. The two candidates or parties with the most votes in the race's whole
area SHALL each have a color, and every other one SHALL share one gray. That area is
Brazil for President and the state for every other race, so a candidate keeps one color
on every map of a race. The margin is the leader's
share of valid votes minus the runner-up's share, in percentage points. It SHALL set the
shade in three bins: under 5 points, from 5 to under 20 points, and 20 points or more.
Each bin SHALL have a name in each language. A municipality where two or more lead with
the same votes SHALL take a separate tie style.

#### Scenario: A municipality led by a minor candidate
- **WHEN** the most voted candidate in a municipality is not among the area's top two
- **THEN** the municipality is gray, and its details name that candidate

#### Scenario: The President race on a state page
- **WHEN** a visitor opens the President map of a state where a third candidate came second
- **THEN** the two colors still belong to the two most voted candidates in Brazil, and the state's runner-up is gray

#### Scenario: A close municipality
- **WHEN** the leader's share exceeds the runner-up's by 3.2 percentage points
- **THEN** the municipality takes the lightest shade of the leader's color

#### Scenario: A tie
- **WHEN** two candidates have the same votes and lead a municipality
- **THEN** the municipality takes the tie style, and its details say that it is a tie

#### Scenario: A deputy race
- **WHEN** a visitor opens the map of a state's federal deputy race
- **THEN** each municipality shows the party with the most valid candidate votes plus list votes there

### Requirement: The legend and the credits are part of the map
Each map SHALL hold, inside its own frame, the race, the area, the round, the legend
with the bin names, a statement that colors show the most voted in each municipality,
and the credits to TSE and to IBGE. A screenshot of the map alone SHALL show all of them.

#### Scenario: A cropped screenshot
- **WHEN** someone captures only the map's frame
- **THEN** the capture shows the race, the round, the legend, the statement about the most voted, and both credits

### Requirement: A map has no basemap and keeps the page scrollable
Maps SHALL draw municipality boundaries only, with no street or terrain basemap. They
SHALL offer no pan and no zoom. On a touch screen, a swipe that starts on a map SHALL
scroll the page. A map SHALL fit a 360-pixel-wide screen without horizontal scrolling.

#### Scenario: Scrolling past a map on a phone
- **WHEN** a visitor on a phone swipes upward with a finger on the map
- **THEN** the page scrolls

#### Scenario: A narrow screen
- **WHEN** a mapped page is opened at 360 pixels wide
- **THEN** the whole map is visible, and the page needs no horizontal scrolling

### Requirement: A municipality's details and its view
When a pointer rests on a municipality, or a finger taps it, the map SHALL show the
municipality's name, its most voted candidate or party, and the margin. A click on a
municipality SHALL open that municipality's view for the race shown. On a touch screen,
the details SHALL hold a link to that view.

#### Scenario: Clicking a municipality
- **WHEN** a visitor clicks Recife on the Governor map of Pernambuco
- **THEN** the municipality view of Recife opens on the Governor race

#### Scenario: Tapping a municipality
- **WHEN** a visitor taps a municipality on a phone
- **THEN** its name, most voted candidate and margin appear, with a link to its view

### Requirement: Every color has a text equivalent
Each page with a map SHALL list the mapped municipalities in its delivered HTML, with
each one's most voted candidate or party, its margin in percentage points, and the
margin's bin name. A visitor SHALL be able to sort the list by name or by margin, and to
filter it by part of a name, ignoring case and accents. On the Brazil page, each state
SHALL link to its state page, where its municipalities are listed. A candidate page SHALL
list each municipality's votes and share for that candidate.

#### Scenario: The list without JavaScript
- **WHEN** a race page is loaded with JavaScript disabled
- **THEN** the list shows every municipality with its most voted candidate and margin, and the page says that the map needs JavaScript

#### Scenario: Sorting by margin
- **WHEN** a visitor sorts a state's list by margin
- **THEN** the municipalities appear from the closest margin to the widest

#### Scenario: Filtering without accents
- **WHEN** a visitor types "sao" in the filter of São Paulo's list
- **THEN** the list keeps every municipality whose name contains "São" or "Sao"

### Requirement: Maps use only checked data
The build SHALL read each municipality's totals from the pinned data version, check the
files against the manifest, and check that the municipalities add up to the area's
summary for every candidate, every party and the valid votes. Any difference SHALL fail
the build, and the build SHALL NOT adjust a value. At run time, the app SHALL draw a map
only after the boundary file's SHA-256 matches its pin. Otherwise the map's place SHALL
show a message in the visitor's language, and the list SHALL stay.

#### Scenario: Totals that do not add up
- **WHEN** a candidate's votes summed over a state's municipalities differ from the state summary
- **THEN** the build fails and names the candidate, the state and both numbers

#### Scenario: Altered boundaries
- **WHEN** the boundary file that a browser receives differs from its pinned SHA-256
- **THEN** no map is drawn, a message says that the map could not load, and the list stays

#### Scenario: A municipality without a boundary
- **WHEN** a municipality in the data has no boundary in the pinned file
- **THEN** the build fails and names the municipality

### Requirement: A page for each majoritarian candidacy
Each candidacy on the ballot for President, Governor or Senate SHALL have a static page
in each language, at an address built from its area, race and ballot number. The page
SHALL show the candidate's ballot name, number, party, votes, share of valid votes and
TSE's outcome for the area. It SHALL map the candidate's share of valid votes by
municipality, on fixed shade steps of 10 percentage points up to 50 points or more. A
candidacy whose votes TSE annulled SHALL show its votes as annulled and no share map.
The race page SHALL link to each of these pages.

#### Scenario: A governor candidate
- **WHEN** a visitor opens the page of a Governor candidate in Bahia
- **THEN** it shows the candidate's results in Bahia and a map of their share in each Bahian municipality

#### Scenario: A President candidate
- **WHEN** a visitor opens the page of a President candidate
- **THEN** it shows the candidate's results for Brazil and a map of their share in every municipality

#### Scenario: Sharing a candidate page
- **WHEN** a visitor copies a candidate page's address and opens it elsewhere
- **THEN** the same candidate's page opens

#### Scenario: Annulled votes
- **WHEN** a candidacy's votes were annulled by TSE
- **THEN** its page shows those votes as annulled and draws no share map
