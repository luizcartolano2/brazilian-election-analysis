## ADDED Requirements

### Requirement: Round-two maps
The round-2 Brazil page SHALL map the round-2 President race by municipality. Each
round-2 state page SHALL map its President race and, in a state with a Governor runoff,
its Governor race. Each round-2 race page SHALL map its own race. Round-2 maps SHALL
follow the rules of round-1 maps: the margin bins, the legend and credits in the frame,
the text equivalent, the checks against the pinned version, and no map for an area with
one municipality or for the votes cast abroad.

#### Scenario: A Governor runoff state
- **WHEN** a visitor opens the round-2 page of Espírito Santo
- **THEN** maps show the President and the Governor runoffs by municipality, each with its list of municipalities

#### Scenario: The Federal District in round two
- **WHEN** a visitor opens the round-2 page of the Federal District
- **THEN** no map is shown, because the district has one municipality

### Requirement: A finalist's page carries both rounds
Once round 2 is pinned, a finalist's candidate page SHALL show a round-2 section above
its round-1 results: the round-2 votes, share of valid votes and TSE's outcome, the
round-2 share map, and the round-2 largest municipalities. A President finalist's
round-2 section SHALL also show, as in round 1, the share in each state with a link to
that state's round-2 page, the count of states led, and the note that its map leaves out
the votes cast abroad, with a link to round 2's votes abroad. In an area with one
municipality, the round-2 section SHALL show no map and no list of municipalities, as in
round 1. The page's address SHALL NOT change. A
candidate who was not a finalist SHALL show round 1 only.

#### Scenario: Lula's page after the runoff
- **WHEN** round 2 is pinned and a visitor opens `/2026/presidente/13/`
- **THEN** the page shows Lula's round-2 results and share map first, and the round-1 results below

#### Scenario: A Federal District finalist
- **WHEN** round 2 is pinned and a visitor opens the page of a Governor finalist in the Federal District
- **THEN** the round-2 section shows the votes, share and outcome, with no map and no list of municipalities

#### Scenario: A candidate eliminated in round one
- **WHEN** a visitor opens the page of a President candidate who was not a finalist
- **THEN** the page shows round 1 only

## MODIFIED Requirements

### Requirement: A candidate keeps the map's color on the whole page
Wherever a page marks a candidate of a President, Governor or Senate race with a color
outside a map, such as a card, a share bar, a legend or a state tile, it SHALL use the
color that the candidate has on that race's maps. The most voted in the race's whole
area takes the first map color, the runner-up takes the second, and every other
candidate takes the gray. The race's whole area is Brazil for President and the state
for every other race. In round 2, each finalist SHALL keep the color of its round-1
ranking, on maps and everywhere else. A color SHALL never be the only mark of a
candidate: a name or a legend next to it SHALL name the candidate.

#### Scenario: The President race on a state page
- **WHEN** the most voted President candidate in a state came second in Brazil
- **THEN** that candidate's card on the state page takes the second map color, as on the President maps

#### Scenario: A third candidate
- **WHEN** a Senate card shows the third most voted candidate in the state
- **THEN** the card's color mark is the gray that the maps use for every other candidate

#### Scenario: The runner-up of round one wins round two
- **WHEN** the second most voted President candidate of round 1 is the most voted in round 2
- **THEN** that candidate keeps the second map color on every round-2 page and map
