## ADDED Requirements

### Requirement: Round-two results
When a round-2 version is pinned, the app SHALL show round 2 under `/2026/segundo-turno/`,
with the same slug in both languages: a Brazil page, a page for each state and for the
votes cast abroad, a race page for each round-2 race, and the municipality, zone and
station views. A round-2 page SHALL follow the same rules as its round-1 counterpart. A
round-2 state page with one race SHALL show no tabs. Every round-1 address SHALL keep
showing round 1.

Before a round-2 version is pinned, `/2026/segundo-turno/` SHALL state the runoff's
date, and that the official results appear once TSE publishes them. It SHALL show no
number, and no other round-2 page SHALL exist.

The Brazil page of round 1 SHALL lead to round 2 with a card below its headline. Before
the results, the card states the runoff's date. After them, it shows the round-2
headline. The header SHALL offer both rounds. It SHALL lead to the same area and race in
the other round when that page exists, and to that round's Brazil page otherwise.

#### Scenario: Before TSE publishes round two
- **WHEN** a visitor opens `/2026/segundo-turno/` and no round-2 version is pinned
- **THEN** the page states that the runoff is on 25 October 2026 and that the results appear once TSE publishes them, and it shows no number

#### Scenario: A round-one address after the runoff
- **WHEN** a round-2 version is pinned and a visitor opens a shared link to `/2026/pe/`
- **THEN** the page shows Pernambuco's round 1, as before

#### Scenario: Switching rounds on a state page
- **WHEN** a visitor on `/2026/rn/` chooses round 2 and Rio Grande do Norte has a Governor runoff
- **THEN** the round-2 page for Rio Grande do Norte opens

#### Scenario: Switching to a race with no runoff
- **WHEN** a visitor on `/2026/sp/senador/` chooses round 2
- **THEN** the round-2 Brazil page opens, because the Senate has no runoff

#### Scenario: A state with President only in round two
- **WHEN** a visitor opens the round-2 page of a state with no Governor runoff
- **THEN** the page shows the President race with no tabs

### Requirement: Headlines follow the round
In round 2, the headline of a race that TSE decided SHALL say that the elected candidate
won in the second round, and no round-2 card SHALL state a runoff date. A finalist's
candidate page SHALL lead with the candidate's round-2 outcome once round 2 is pinned.
The headline SHALL still come from TSE's outcome only.

#### Scenario: A President elected in round two
- **WHEN** TSE marks a President candidate as elected in round 2
- **THEN** the round-2 Brazil page's headline says that the candidate wins in the second round

#### Scenario: A finalist's candidate page
- **WHEN** round 2 is pinned and a visitor opens a finalist's page
- **THEN** the page leads with the finalist's round-2 outcome, and still shows the round-1 results below

## MODIFIED Requirements

### Requirement: One pinned and verified data version
The app SHALL be built against one data version for round 1, and at most one for round
2, each named together with the SHA-256 of its manifest. The build SHALL fail when a
pinned manifest is missing, when its checksum differs, when it names another year or
round than its pin, or when any summary file it reads differs from the manifest. At run
time the app SHALL read data only from the pinned versions and from its pinned boundary
build, all through the Worker, and from files that the build derived from those versions
and serves from the app's own origin.

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

#### Scenario: A version pinned to the wrong round
- **WHEN** the round-2 pin names a version whose manifest says round 1
- **THEN** the build fails

#### Scenario: No round-two version yet
- **WHEN** the app is built with no round-2 pin
- **THEN** the build succeeds, and no round-2 results page is written
