## Purpose

Shows where each candidate led and how strongly, by municipality, on the Brazil, state,
race and candidate pages, with every color also readable as text.

## ADDED Requirements

### Requirement: Maps on the Brazil, state and race pages
The Brazil page SHALL map the President race by municipality. Each state page SHALL map
its Governor race by municipality, and each race page SHALL map its own race. A page
whose area has only one municipality, such as the Federal District, SHALL show no map.
Votes cast abroad SHALL NOT appear on any map. The Brazil map SHALL link to the abroad
page instead. Pernambuco's maps SHALL draw Fernando de Noronha in an inset, because the
island lies far off the coast.

#### Scenario: The Brazil page
- **WHEN** a visitor opens the Brazil page
- **THEN** a map shows the President race for every municipality in Brazil, and a link leads to the votes cast abroad

#### Scenario: A state's race page
- **WHEN** a visitor opens the Senate race page for a state
- **THEN** a map shows that state's municipalities colored for the Senate race

#### Scenario: The Federal District
- **WHEN** a visitor opens the Federal District's page
- **THEN** no map is shown, because the district has one municipality

### Requirement: Colors show the most voted
On a President or Governor map, each municipality SHALL take the color of its most voted
candidate. On a deputy map, it SHALL take the color of the federation with the most
votes there, or of the party where a party runs outside any federation. A federation's
votes are the valid candidate votes and the list votes of its parties. The two
candidates, federations or parties with the most votes in the race's whole area SHALL
each have a color, and every other one SHALL share one gray. That area is Brazil for
President and the state for every other race, so a candidate keeps one color on every
map of a race. A municipality where two or more lead with the same votes SHALL take a
separate tie style.

On these maps the margin is the leader's share of valid votes minus the runner-up's
share, in percentage points. It SHALL set the shade in three bins: under 5 points, from
5 to under 20 points, and 20 points or more. Each bin SHALL have a name in each
language.

On a Senate map, each municipality SHALL take the color of its most voted candidate in
one shade, with no margin bins, because each voter chose two candidates and two win.

#### Scenario: A municipality led by a minor candidate
- **WHEN** the most voted candidate in a municipality is not among the race's top two
- **THEN** the municipality is gray, and its details name that candidate

#### Scenario: The President race on a state page
- **WHEN** a visitor opens the President map of a state where a third candidate came second
- **THEN** the two colors still belong to the two most voted candidates in Brazil, and the state's runner-up is gray

#### Scenario: A close municipality
- **WHEN** the leader's share exceeds the runner-up's by 3.2 percentage points on a Governor map
- **THEN** the municipality takes the lightest shade of the leader's color

#### Scenario: A tie
- **WHEN** two candidates have the same votes and lead a municipality
- **THEN** the municipality takes the tie style, and its details say that it is a tie

#### Scenario: A deputy race
- **WHEN** a visitor opens the map of a state's federal deputy race
- **THEN** each municipality shows the federation, or the party outside any federation, with the most valid candidate votes plus list votes there

#### Scenario: A Senate race
- **WHEN** a visitor opens a Senate map
- **THEN** each municipality shows its most voted candidate in one shade, and the map states that each voter chose two candidates for two seats

### Requirement: The legend and the credits are part of the map
Each map SHALL hold, inside its own frame, the race, the area, the round, its legend and
the credits to TSE and to IBGE. The legend of a most-voted map SHALL say that colors
show the most voted in each municipality, and SHALL name the margin bins where the map
has them. The legend of a share map SHALL name its steps and say that shares are of
valid votes. A Senate map's frame SHALL state that each voter chose two candidates. A
screenshot of the map alone SHALL show all of them.

#### Scenario: A cropped screenshot
- **WHEN** someone captures only the frame of a Governor map
- **THEN** the capture shows the race, the area, the round, the legend with the bin names, the statement about the most voted, and both credits

#### Scenario: A cropped share map
- **WHEN** someone captures only the frame of a Senate candidate's share map
- **THEN** the capture shows the candidate, the area, the round, the steps, that shares are of valid votes, that each voter chose two, and both credits

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
municipality's details. On a most-voted map, the details are its name, its most voted
and, where the map has bins, the margin. On a Senate map, they are its name and its two
most voted candidates with their shares. On a share map, they are its name and the
candidate's votes and share. A click on a municipality SHALL open that municipality's
view for the race shown. On a touch screen, the details SHALL hold a link to that view.

#### Scenario: Clicking a municipality
- **WHEN** a visitor clicks Recife on the Governor map of Pernambuco
- **THEN** the municipality view of Recife opens on the Governor race

#### Scenario: Tapping a municipality
- **WHEN** a visitor taps a municipality on a phone
- **THEN** its details appear, with a link to its view

### Requirement: Every color has a text equivalent
Each state and race page with a map SHALL list the mapped municipalities in its
delivered HTML. On a most-voted map, each row SHALL show the municipality's most voted
and, where the map has bins, the margin in percentage points and the bin's name. A
visitor SHALL be able to sort the list by name or by margin, and to filter it by part of
a name, ignoring case and accents. On the Brazil page, each state SHALL link to its
President race page, which lists that state's municipalities for the President race. A
candidate page SHALL list each municipality's votes and share for that candidate,
grouped by state on a President candidate's page.

#### Scenario: The list without JavaScript
- **WHEN** a race page is loaded with JavaScript disabled
- **THEN** the list shows every municipality with its most voted and margin, and the page says that the map needs JavaScript

#### Scenario: Sorting by margin
- **WHEN** a visitor sorts a state's list by margin
- **THEN** the municipalities appear from the closest margin to the widest

#### Scenario: Filtering without accents
- **WHEN** a visitor types "sao" in the filter of a list that holds "São Paulo"
- **THEN** the list keeps "São Paulo"

#### Scenario: The Brazil map's text
- **WHEN** a keyboard user on the Brazil page wants a municipality's President result
- **THEN** the state's link to its President race page leads to a list that holds it

### Requirement: Maps use only checked data
The build SHALL read each municipality's totals and the candidate registry from the
pinned data version, and check the files against the manifest. It SHALL check that the
municipalities add up to the area's summary for every candidate, every party's valid
candidate votes plus list votes, and the valid votes. The Brazil check SHALL include the
cities abroad, because the Brazil summary includes them. Any difference SHALL fail the
build, and the build SHALL NOT adjust a value.

At run time, the app SHALL draw a map only after its boundary file arrives and its
SHA-256 matches the pin. Otherwise the map's place SHALL show a message in the visitor's
language, and the list SHALL stay.

#### Scenario: Totals that do not add up
- **WHEN** a candidate's votes summed over a state's municipalities differ from the state summary
- **THEN** the build fails and names the candidate, the state and both numbers

#### Scenario: Votes under appeal
- **WHEN** a state's federal deputy race holds candidates whose votes TSE annulled sub judice
- **THEN** the party check compares only the valid candidate votes plus list votes, and passes

#### Scenario: The Brazil check
- **WHEN** the build checks the President race for Brazil
- **THEN** it sums every municipality and every city abroad before it compares with the Brazil summary

#### Scenario: Altered boundaries
- **WHEN** the boundary file that a browser receives differs from its pinned SHA-256
- **THEN** no map is drawn, a message says that the map did not load, and the list stays

#### Scenario: A failed boundary download
- **WHEN** the boundary file does not arrive, because the Worker fails or the visitor is offline
- **THEN** no map is drawn, a message says that the map did not load, and the list stays

#### Scenario: A municipality without a boundary
- **WHEN** a municipality in the data has no boundary in the pinned build
- **THEN** the build fails and names the municipality

### Requirement: A page for each majoritarian candidacy
Each candidacy in the pinned summaries for President, Governor or Senate SHALL have a
static page in each language, at an address built from its area, race and ballot
number. The page SHALL show the candidate's ballot name, number, party, votes and TSE's
outcome for the area. A candidacy with valid votes SHALL also show its share of valid
votes and map that share by municipality. The steps are 10 percentage points up to 50
or more for President and Governor, and 5 points up to 25 or more for the Senate,
because each Senate voter chose two candidates. A candidacy whose votes TSE annulled sub
judice SHALL show its votes as under appeal, with TSE's status, and no share map. In an
area with one municipality, the page SHALL show no share map. The race page SHALL link
to each of these pages.

#### Scenario: A governor candidate
- **WHEN** a visitor opens the page of a Governor candidate in Bahia
- **THEN** it shows the candidate's results in Bahia and a map of their share in each Bahian municipality

#### Scenario: A President candidate
- **WHEN** a visitor opens the page of a President candidate
- **THEN** it shows the candidate's results for Brazil and a map of their share in every municipality

#### Scenario: Sharing a candidate page
- **WHEN** a visitor copies a candidate page's address and opens it elsewhere
- **THEN** the same candidate's page opens

#### Scenario: Votes under appeal
- **WHEN** a Senate candidacy's destination in TSE's aggregate is "Anulado sub judice"
- **THEN** its page shows its votes as under appeal with that status, and draws no share map

### Requirement: Pages stay light enough for a phone
No page in the static export SHALL exceed 2.5 MB of HTML. The build or CI SHALL fail when
one does.

#### Scenario: A page grows too large
- **WHEN** a change makes any exported page larger than 2.5 MB
- **THEN** CI fails and names the page and its size
