## MODIFIED Requirements

### Requirement: Results for every race at every level
For a chosen race and area, the app SHALL show the candidates' votes and shares of valid
votes, ordered by votes, together with blank votes, null votes, technical nulls,
attendance and abstention. It SHALL also show annulled and annulled sub judice votes
whenever they are not zero, as TSE does. Levels are Brazil, state, municipality, zone and
polling station. President is available at every level, including votes cast abroad.
Governor, Senate and the deputy races are available from the state level down. The
Federal District shows its district deputy race in place of a state deputy race. Fernando
de Noronha also shows its Conselheiro Distrital race, from the municipality level down.
In the deputy races, the page SHALL also show each party's list votes and its total of
candidate and list votes, so every vote counted in the valid-vote denominator is visible.
Every vote under appeal SHALL appear on the line of a named candidate or party list, and
the build SHALL fail when those lines add up to more or less than the race's votes under
appeal. A party's candidate votes SHALL be the sum of its valid candidates' votes, so a
data version of schema version 1, whose `votos_candidatos` also counts votes under
appeal, shows the same party totals as a later one. At the Brazil and state levels, and
abroad, the list SHALL hold every candidate in the race. In a municipality, zone or
polling station, it SHALL hold every candidate with at least one vote there, and the page
SHALL say that the others are left out.

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
- **THEN** the page shows them on their own lines, each under a named candidate or party list, apart from valid votes

#### Scenario: A race that does not exist at that level
- **WHEN** a visitor opens the governor race for Brazil as a whole
- **THEN** the app offers the state list instead of empty results

#### Scenario: Votes under appeal with no named line
- **WHEN** a summary's lines under appeal add up to less than the race's votes under appeal
- **THEN** the build fails, and names the race and both numbers

### Requirement: One pinned and verified data version
The app SHALL be built against one data version for round 1, and at most one for round 2,
each named together with the SHA-256 of its manifest. The build SHALL fail when a pinned
manifest is missing, when its checksum differs, when it names another year or round than
its pin, or when any summary file it reads differs from the manifest. It SHALL also fail
when the races that a pinned version reconciled, as its manifest's
`verificacoes.agregado` lists them, differ from its round's list in `web/src/pinned-
races.json`, when a pinned round has no list there, or when the manifest records no
reconciled races. One error SHALL name every race that differs. CI SHALL run these checks
on the pinned versions for every change, without a build. The list verifies the races
that the pipeline took from TSE's vote rows, and never decides them. At run time the app
SHALL read data only from the pinned versions and from its pinned boundary build, all
through the Worker, and from files that the build derived from those versions and serves
from the app's own origin.

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
- **THEN** the build fails, until a PR pins the republished round 1, and removes Rio's Governor race from the round-2 list if an earlier pin listed it

#### Scenario: A pin that drops a race
- **WHEN** a new round-1 version did not reconcile Acre's Senate race, which the round-1 list holds
- **THEN** the build fails and names the race, and passes only once a PR removes the race from the list on purpose

#### Scenario: A pin that adds a race
- **WHEN** a new version reconciled a race that its round's list lacks
- **THEN** the build fails and names the race, until a PR adds it to the list

#### Scenario: A round's first pin
- **WHEN** a PR sets the round-2 pin and leaves the round-2 list empty
- **THEN** the build fails, and says to copy the list from the manifest's `verificacoes.agregado`
