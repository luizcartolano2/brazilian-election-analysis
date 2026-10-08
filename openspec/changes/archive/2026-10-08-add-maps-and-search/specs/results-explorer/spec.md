## MODIFIED Requirements

### Requirement: Every number traces to its source
Every page SHALL credit TSE. A sources page SHALL list each TSE source, its license, the
data version in use, and a link to that version's manifest. It SHALL also list the map
boundaries: IBGE's edition, IBGE's terms, that this project simplified them, and the
boundary build in use with a link to its manifest. A polling station's page SHALL link to
TSE's own page for that station.

#### Scenario: Checking a station against TSE
- **WHEN** a visitor on a polling station's page follows the link to TSE
- **THEN** TSE's results site opens on the same station

#### Scenario: The data version is visible
- **WHEN** a visitor opens the sources page
- **THEN** it shows the pinned data version and links to its manifest

#### Scenario: The boundaries are visible
- **WHEN** a visitor opens the sources page
- **THEN** it names IBGE's 2025 municipal boundaries, their terms, that they were simplified, and the boundary build in use with a link to its manifest

### Requirement: One pinned and verified data version
The app SHALL be built against one data version, named together with the SHA-256 of its
manifest. The build SHALL fail when that manifest is missing, when its checksum differs,
or when any summary file it reads differs from the manifest. At run time the app SHALL
read data only from that version and from its pinned boundary build, both through the
Worker, and from files that the build derived from that version and serves from the
app's own origin.

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
