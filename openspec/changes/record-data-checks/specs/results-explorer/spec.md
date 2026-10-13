## MODIFIED Requirements

### Requirement: One pinned and verified data version
The app SHALL be built against one data version for round 1, and at most one for round
2, each named together with the SHA-256 of its manifest. The build SHALL fail when a
pinned manifest is missing, when its checksum differs, when it names another year or
round than its pin, or when any summary file it reads differs from the manifest. It SHALL
also fail when the races that a pinned version reconciled, as its manifest's
`verificacoes.agregado` lists them, differ from its round's list in
`web/src/pinned-races.json`, when a pinned round has no list there, or when the manifest
records no reconciled races. One error SHALL name every race that differs. CI SHALL run
these checks on the pinned versions for every change, without a build. At run
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
- **THEN** the build fails, until a PR pins the republished round 1, and removes Rio's Governor race from the round-2 list if an earlier pin listed it

#### Scenario: A pin that drops a race
- **WHEN** a new round-1 version did not reconcile Fernando de Noronha's council, which the round-1 list holds
- **THEN** the build fails and names the race, until a PR removes it from the list

#### Scenario: A pin that adds a race
- **WHEN** a new version reconciled a race that its round's list lacks
- **THEN** the build fails and names the race, until a PR adds it to the list

#### Scenario: A round's first pin
- **WHEN** a PR sets the round-2 pin and leaves the round-2 list empty
- **THEN** the build fails, and says to copy the list from the manifest's `verificacoes.agregado`
