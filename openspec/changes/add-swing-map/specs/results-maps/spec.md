## ADDED Requirements

### Requirement: A finalist's swing between the rounds
When both pinned rounds come from TSE's own files, a finalist's round-2 section SHALL show
a swing map below its round-2 share map. A finalist's head-to-head share in a municipality
SHALL be its votes divided by the two finalists' combined votes in one round. The swing
SHALL be the round-2 head-to-head share minus the round-1 head-to-head share, in
percentage points. One finalist's swing SHALL equal the other finalist's swing with the
opposite sign.

A municipality where the two finalists had no votes in a round SHALL have no swing, and
SHALL take the map's no-data fill. When either pinned round is synthetic, the page SHALL
show no swing map.

The swing map SHALL read the same values files as the section's share maps, one per round,
and SHALL draw only after both files arrive and their SHA-256 values match the page's.
Otherwise it SHALL follow a share map's rules: no colors and no list, a message in the
visitor's language, a retry that bypasses the browser's cache, and an offer to reload the
page when a file no longer exists. As with a share map, an area with one municipality
SHALL get no swing map.

A folded list SHALL follow the swing map, with a summary that names its count of
municipalities. Each row SHALL show the municipality's head-to-head share in each round and
the swing. A visitor SHALL be able to sort the list by name or by swing, and to filter it by
part of a name, ignoring case and accents. Without JavaScript, the page SHALL say that the
swing map and its list need JavaScript.

#### Scenario: Lula's swing map
- **WHEN** both rounds are pinned from TSE's files and a visitor opens `/2026/presidente/13/`
- **THEN** the round-2 section shows, below the round-2 share map, a map of Lula's change in head-to-head share by municipality, followed by its folded list

#### Scenario: The two finalists mirror each other
- **WHEN** a visitor compares the two President finalists' swing maps
- **THEN** each municipality shows the same size of change on both maps, with opposite signs

#### Scenario: A Governor runoff
- **WHEN** both rounds are pinned from TSE's files and a visitor opens the page of a Governor finalist in a state with a runoff
- **THEN** the round-2 section shows a swing map of that state's municipalities

#### Scenario: A finalist in the Federal District
- **WHEN** a visitor opens the page of a Governor finalist in the Federal District
- **THEN** the round-2 section shows no swing map, because the district has one municipality

#### Scenario: No votes for the finalists
- **WHEN** the two finalists had no votes in a municipality in round 1
- **THEN** that municipality takes the no-data fill, and its row in the list says that the finalists had no votes in round 1

#### Scenario: The synthetic round two
- **WHEN** a test build pins the synthetic round 2
- **THEN** no finalist's page shows a swing map

#### Scenario: The page's weight
- **WHEN** the page size gate measures a finalist's page with a swing map
- **THEN** the page counts the same values files as without the swing map

#### Scenario: A values file that fails
- **WHEN** one of the two values files arrives with a SHA-256 that differs from the page's
- **THEN** the swing map shows neither colors nor a list, says that its values failed to load, and offers a retry

#### Scenario: Sorting by swing
- **WHEN** a visitor sorts the swing list by swing
- **THEN** the municipalities appear from the largest gain to the largest loss

### Requirement: The swing map says what it compares
The swing map SHALL hold, inside its own frame: the finalist, the area, both rounds, a
legend whose steps are centered on zero, and the credits to TSE and to IBGE. The frame
SHALL state that the map compares two official counts of the two finalists' votes, and
that the eliminated candidates' votes enter neither round's share. The palette SHALL be
centered on zero, with a neutral middle step, and SHALL use neither of the two candidate
colors. No text, chart or list on the page SHALL state or estimate where any voter's vote
went between the rounds.

#### Scenario: A cropped swing map
- **WHEN** someone captures only the frame of Lula's swing map
- **THEN** the capture shows Lula, Brazil, both rounds, the steps centered on zero, the statement that the map compares two official counts of the finalists' votes, and both credits

#### Scenario: A gain with no attribution
- **WHEN** the swing map shows a finalist's gain in a municipality
- **THEN** neither the frame nor the list attributes the gain to any other candidate's voters
