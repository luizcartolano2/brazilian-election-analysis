## ADDED Requirements

### Requirement: A candidate keeps the map's color on the whole page
Wherever a page marks a candidate of a President, Governor or Senate race with a color
outside a map, such as a card, a share bar, a legend or a state tile, it SHALL use the
color that the candidate has on that race's maps. The most voted in the race's whole
area takes the first map color, the runner-up takes the second, and every other
candidate takes the gray. The race's whole area is Brazil for President and the state
for every other race. A color SHALL never be the only mark of a candidate: a name or a
legend next to it SHALL name the candidate.

#### Scenario: The President race on a state page
- **WHEN** the most voted President candidate in a state came second in Brazil
- **THEN** that candidate's card on the state page takes the second map color, as on the President maps

#### Scenario: A third candidate
- **WHEN** a Senate card shows the third most voted candidate in the state
- **THEN** the card's color mark is the gray that the maps use for every other candidate

### Requirement: The closest municipalities
The Governor tab of a state page SHALL list the five municipalities where the margin
between the two most voted Governor candidates is smallest. Each row SHALL name the
municipality, both candidates and the margin in percentage points, and SHALL link to the
municipality's view. A tie SHALL show as a tie, with a margin of zero. The list SHALL use
the same municipality values as the state's Governor map. A state with fewer than two
municipalities shows no list.

#### Scenario: A close Governor race in a municipality
- **WHEN** a municipality's two most voted Governor candidates are 0.2 points apart, the smallest margin in the state
- **THEN** it is the first row of the list, with both names and "0,2 p.p." on the Portuguese page

#### Scenario: A tie
- **WHEN** two Governor candidates have the same votes in a municipality
- **THEN** the municipality appears in the list as a tie

## MODIFIED Requirements

### Requirement: A page for each majoritarian candidacy
Each candidacy in the pinned summaries for President, Governor or Senate SHALL have a
static page in each language, at an address built from its area, race and ballot
number. The page SHALL show the candidate's ballot name, number, party, votes and TSE's
outcome for the area. A candidacy with valid votes SHALL also show its share of valid
votes and its place in the race by votes, and map that share by municipality. The steps
are 10 percentage points up to 50 or more for President and Governor, and 5 points up to
25 or more for the Senate, because each Senate voter chose two candidates. A candidacy
whose votes TSE annulled sub judice SHALL show its votes as under appeal, with TSE's
status, no place in the race and no share map. In an area with one municipality, the
page SHALL show no share map. A President candidate's page SHALL say that its map leaves
out the votes cast abroad, and link to them. Every results table of a President, Governor
or Senate race SHALL link each candidate to their page.

Below the map, a candidacy with valid votes SHALL list up to six municipalities of its
area, those with the most valid votes, with the candidate's share in each. In an area
with one municipality, the page shows no such list. A President candidate's page SHALL
also list the candidate's share in each state, from the highest to the lowest, and SHALL
state in how many states the candidate was the most voted. Each state in that list SHALL
link to the state's page.

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

#### Scenario: A President candidate's states
- **WHEN** a visitor opens the page of a President candidate who was the most voted in 12 states
- **THEN** the page states 12 states, and lists the candidate's share in all 27 states from the highest to the lowest

#### Scenario: An area with one municipality
- **WHEN** a visitor opens the page of a Governor candidate in the Federal District
- **THEN** the page shows neither a share map nor a list of municipalities

#### Scenario: The largest municipalities
- **WHEN** a visitor opens the page of a Governor candidate in São Paulo
- **THEN** the page lists the six São Paulo municipalities with the most valid votes, with the candidate's share in each
