## MODIFIED Requirements

### Requirement: A finalist's swing between the rounds
A finalist's round-2 section SHALL show a swing map below its round-2 share map when all of
these hold: round 2 is in the build, neither round's data version is marked synthetic,
both finalists' votes are valid in both rounds' summaries, and both rounds' values files
for the area list the same municipalities. Otherwise the section SHALL show no swing map.
A fixtures build that sets the fixtures-only swing switch SHALL lift the rule on synthetic
data, and no other build SHALL accept that switch.

A finalist's head-to-head share in a municipality SHALL be its votes divided by the two
finalists' combined votes in one round. The swing SHALL be the round-2 head-to-head share
minus the round-1 head-to-head share, in percentage points, rounded to one decimal. One
finalist's swing SHALL equal the other finalist's swing with the opposite sign.

The map SHALL color a municipality by its rounded swing in seven steps: under 1 point in
either direction, from 1 to under 3, from 3 to under 6, and 6 or more, in each direction.
The edges SHALL apply to the swing's absolute value, so swings of +1.0 and −1.0 take the
same step on opposite sides. A municipality where the two finalists had no votes in a round
SHALL have no swing, and SHALL take a hatched no-data fill that no step uses.

The swing map SHALL read the same values files as the page's share maps, one per round,
and SHALL draw only after both files arrive and their SHA-256 values match the page's.
Otherwise it SHALL follow a share map's rules: no colors and no list, a message in the
visitor's language, a retry that bypasses the browser's cache, and an offer to reload the
page when a file no longer exists. As with a share map, an area with one municipality
SHALL get no swing map.

Pointing at or tapping a municipality SHALL show its name, the finalist's share of the two
finalists' votes in each round, and the swing. Clicking it SHALL open that municipality's
round-2 view for the race.

A folded list SHALL follow the swing map, with a summary that names its count of
municipalities. Each row SHALL show the municipality's head-to-head share in each round and
the swing. A visitor SHALL be able to sort the list by name or by swing, and to filter it by
part of a name, ignoring case and accents. Without JavaScript, the page SHALL say that the
swing map and its list need JavaScript.

#### Scenario: Lula's swing map
- **WHEN** round 2 is pinned and a visitor opens `/2026/presidente/13/`
- **THEN** the round-2 section shows, below the round-2 share map, a map of Lula's change in head-to-head share by municipality, followed by its folded list

#### Scenario: The two finalists mirror each other
- **WHEN** a visitor compares the two President finalists' swing maps
- **THEN** each municipality shows the same size of change on both maps, with opposite signs, in mirrored steps

#### Scenario: A swing on a step's edge
- **WHEN** a municipality's rounded swing is +1.0 for one finalist and −1.0 for the other
- **THEN** both maps put it in the step from 1 to under 3 points, on opposite sides of zero

#### Scenario: A Governor runoff
- **WHEN** round 2 is pinned and a visitor opens the page of a Governor finalist in a state with a runoff
- **THEN** the round-2 section shows a swing map of that state's municipalities

#### Scenario: A finalist in the Federal District
- **WHEN** a visitor opens the page of a Governor finalist in the Federal District
- **THEN** the round-2 section shows no swing map, because the district has one municipality

#### Scenario: A finalist's votes under appeal
- **WHEN** TSE annuls one finalist's round-2 votes sub judice
- **THEN** neither finalist's page shows a swing map

#### Scenario: Rounds that list different municipalities
- **WHEN** a race's round-1 and round-2 values files for an area list different municipalities
- **THEN** neither finalist's page shows a swing map for that area, and the build prints the municipality codes that differ

#### Scenario: No votes for the finalists
- **WHEN** the two finalists had no votes in a municipality in round 1
- **THEN** that municipality takes the hatched no-data fill, apart from every step, and its row in the list says that the finalists had no votes in round 1

#### Scenario: The synthetic round two
- **WHEN** a build pins the synthetic round 2 without the fixtures-only swing switch
- **THEN** no finalist's page shows a swing map

#### Scenario: The swing switch outside the fixtures
- **WHEN** a build that reads a pinned data version sets the fixtures-only swing switch
- **THEN** the build fails before it writes any page

#### Scenario: A municipality's details
- **WHEN** a visitor points at a municipality on Lula's swing map
- **THEN** the details show the municipality, Lula's share of the two finalists' votes in round 1 and in round 2, and the swing

#### Scenario: Clicking a municipality
- **WHEN** a visitor clicks a municipality on a swing map
- **THEN** the page opens that municipality's round-2 view for the race

#### Scenario: The page's weight
- **WHEN** the page size gate measures a finalist's page with a swing map
- **THEN** the page counts the same values files as without the swing map, plus the section's HTML

#### Scenario: A values file that fails
- **WHEN** one of the two values files arrives with a SHA-256 that differs from the page's
- **THEN** the swing map shows neither colors nor a list, says that its values failed to load, and offers a retry

#### Scenario: Sorting by swing
- **WHEN** a visitor sorts the swing list by swing
- **THEN** the municipalities appear from the largest gain to the largest loss, and municipalities with no swing come last

### Requirement: The swing map says what it compares
The swing map SHALL hold, inside its own frame: the finalist, the race, the area, both
rounds, a legend with the seven signed steps and the no-data fill, and the credits to TSE
and to IBGE. The frame SHALL state that the map compares two official counts of the two
finalists' votes. It SHALL state that a change mixes differences in turnout, the round-1
votes of the eliminated candidates, and votes that changed between the finalists, and that
TSE's files cannot separate them. It SHALL state that the map does not show where any
voter's vote went. On Brazil's map, the frame SHALL also state that the map leaves out
the votes cast abroad.

Each label of a head-to-head share, in the frame, the details and the list, SHALL name its
denominator as the two finalists' votes. No such label SHALL call it a share of the valid
votes. The palette SHALL be centered on zero, with a neutral middle step, and SHALL use
neither of the two candidate colors. No heading, frame, detail or list of the swing map SHALL
say that a vote went from one candidate to another, or estimate where any voter's vote
went.

#### Scenario: A cropped swing map
- **WHEN** someone captures only the frame of a Governor finalist's swing map
- **THEN** the capture shows the finalist, the Governor race, the state, both rounds, the seven steps and the no-data fill, the statements about what the map compares and does not show, and both credits

#### Scenario: Labels that name the denominator
- **WHEN** a visitor reads the swing list's column headers or a municipality's details
- **THEN** each share reads as a share of the two finalists' votes, and none reads as a share of the valid votes

#### Scenario: A gain with no attribution
- **WHEN** the swing map shows a finalist's gain in a municipality
- **THEN** neither the heading, the frame, the details nor the list attributes the gain to any other candidate's voters

#### Scenario: A cropped Brazil swing map
- **WHEN** someone captures only the frame of Lula's swing map
- **THEN** the capture also states that the map leaves out the votes cast abroad
