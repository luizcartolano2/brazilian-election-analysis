## MODIFIED Requirements

### Requirement: The manifest completes a version
Each version SHALL contain a `manifest.json` that lists every data file with its size and
SHA-256, every TSE source with its URL, SHA-512 and download time, the pipeline commit,
the time the publish run built the data, the schema version, and the TSE credit line. It
SHALL also record, under `verificacoes`, the checks that the build ran: the station
check, each election and race that it checked by municipality and zone, each race that it
reconciled with TSE's aggregate, and each summary that it checked. The manifest SHALL be
uploaded last, so a version without a manifest is incomplete and SHALL NOT be pinned by
the app.

#### Scenario: Verifying a published version
- **WHEN** anyone downloads a version's files and its manifest
- **THEN** every file's SHA-256 matches the manifest entry

#### Scenario: An upload is interrupted
- **WHEN** a publish stops after some data files were uploaded but before the manifest
- **THEN** that version has no manifest, and the next publish uses a new version path

#### Scenario: Reading a version's checks
- **WHEN** anyone reads a version's manifest
- **THEN** it lists each race that the build reconciled with TSE's aggregate, as its area, election and race
