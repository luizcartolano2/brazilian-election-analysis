## ADDED Requirements

### Requirement: Round-two results
The app SHALL show round 2 under `/2026/segundo-turno/`, with the same slug in both
languages. Every round-1 address SHALL keep showing round 1. Once a round-2 version is
pinned, round 2 SHALL have these pages:

- A Brazil page, with the President race and a tile for each state.
- A page for each state and for the votes cast abroad.
- A race page for each round-2 race of each state.
- The municipality, zone and station views.

Round 2 holds the President race and the Governor runoffs only. A round-2 state page
with both races SHALL show them in tabs, Governor first, and each tab panel SHALL hold
its own race's map. The list of the closest municipalities SHALL sit in the Governor
panel. A round-2 state page with one race SHALL show no tabs.

Before a round-2 version is pinned, every round-2 address SHALL either show the waiting
content or not exist. The waiting content states the runoff's date, and that the
official results appear once TSE publishes them. It SHALL show no vote count, share or
other result.

The Brazil page of round 1 SHALL lead to round 2 with a card below its candidate cards.
Before the results, the card states the runoff's date. After them, it shows the round-2
headline.

The header SHALL offer both rounds. On a page of one round, the other round's choice
SHALL lead to the same area and race in that round when that page exists, else to the
same area, else to that round's Brazil page. The current round SHALL be marked with
`aria-current`. On a finalist's candidate page, which shows both rounds, each choice
SHALL lead to that round's section of the page, and neither SHALL be marked current. On
the sources page, which serves both rounds, each choice SHALL lead to that round's
Brazil page, and neither SHALL be marked current.

#### Scenario: Before TSE publishes round two
- **WHEN** a visitor opens `/2026/segundo-turno/` and no round-2 version is pinned
- **THEN** the page states that the runoff is on 25 October 2026 and that the results appear once TSE publishes them, and it shows no vote count or share

#### Scenario: A round-two drill-down view before the pin
- **WHEN** a visitor opens the round-2 station view and no round-2 version is pinned
- **THEN** the view shows the waiting content and requests no data

#### Scenario: A round-one address after the runoff
- **WHEN** a round-2 version is pinned and a visitor opens a shared link to `/2026/pe/`
- **THEN** the page shows Pernambuco's round-1 results, as before

#### Scenario: Switching rounds on a state page
- **WHEN** a visitor on `/2026/rn/` chooses round 2 and Rio Grande do Norte has a Governor runoff
- **THEN** the round-2 page for Rio Grande do Norte opens

#### Scenario: Switching to a race with no runoff
- **WHEN** a visitor on `/2026/sp/senador/` chooses round 2
- **THEN** the round-2 page for São Paulo opens, because the Senate has no runoff and the state has a round-2 page

#### Scenario: Switching on a finalist's page
- **WHEN** round 2 is pinned and a visitor on a finalist's candidate page chooses round 1
- **THEN** the page scrolls to its round-1 section, and neither choice is marked current

#### Scenario: A state with President only in round two
- **WHEN** a visitor opens the round-2 page of a state with no Governor runoff
- **THEN** the page shows the President race with no tabs

#### Scenario: A state with a Governor runoff
- **WHEN** a visitor opens the round-2 page of Espírito Santo
- **THEN** the Governor tab comes first, and its panel holds the Governor map and the closest municipalities

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

### Requirement: Every number traces to its source
Every page SHALL credit TSE. A sources page SHALL list each TSE source, its license, each
pinned data version with the round it holds, and a link to each version's manifest. It
SHALL also list the map boundaries: IBGE's edition, IBGE's terms, that this project
simplified them, and the boundary build in use with a link to its manifest. A polling
station's page SHALL link to TSE's own page for that station, in the round and race that
the page shows.

#### Scenario: Checking a station against TSE
- **WHEN** a visitor on a polling station's page follows the link to TSE
- **THEN** TSE's results site opens on the same station

#### Scenario: Checking a round-two station against TSE
- **WHEN** a visitor on a round-2 station's page follows the link to TSE for the President or the Governor race
- **THEN** TSE's results site opens on the same station, under election 6258 for President or 6260 for Governor

#### Scenario: The data version is visible
- **WHEN** a visitor opens the sources page
- **THEN** it shows the pinned data version and links to its manifest

#### Scenario: Both data versions are visible
- **WHEN** round 2 is pinned and a visitor opens the sources page
- **THEN** it shows the round-1 and the round-2 versions, each with its round and a link to its manifest

#### Scenario: The boundaries are visible
- **WHEN** a visitor opens the sources page
- **THEN** it names IBGE's 2025 municipal boundaries, their terms, that they were simplified, and the boundary build in use with a link to its manifest

### Requirement: One pinned and verified data version
The app SHALL be built against one data version for round 1, and at most one for round
2, each named together with the SHA-256 of its manifest. The build SHALL fail when a
pinned manifest is missing, when its checksum differs, when it names another year or
round than its pin, or when any summary file it reads differs from the manifest. At run
time the app SHALL read data only from the pinned versions and from its pinned boundary
build, all through the Worker, and from files that the build derived from those versions
and serves from the app's own origin.

When round 2 is pinned, the build SHALL also fail unless the two versions agree. Each
round-2 race SHALL hold exactly the candidates that the round-1 version marks for a
runoff in that race. Each race that the round-1 version marks for a runoff SHALL appear
in round 2. The search index SHALL come from the round-1 version alone, so a candidacy in
the search shows TSE's round-1 outcome.

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
- **THEN** the index comes from the app's own origin, and the build derived it from the round-1 version's summaries

#### Scenario: A version pinned to the wrong round
- **WHEN** the round-2 pin names a version whose manifest says round 1
- **THEN** the build fails

#### Scenario: No round-two version yet
- **WHEN** the app is built with no round-2 pin
- **THEN** the build succeeds, and no round-2 page shows a result

#### Scenario: Rio's runoff cancelled before round one is republished
- **WHEN** the round-2 version holds no Governor race for Rio de Janeiro, and the pinned round-1 version still marks Rio's Governor race for a runoff
- **THEN** the build fails, until a PR pins the republished round 1
