## ADDED Requirements

### Requirement: A version holds one round
Each published version SHALL hold one round, and its manifest SHALL name that round. The
publish workflow SHALL take the round as an input, and SHALL build only that round. A
new version of one round SHALL NOT change any version of the other round.

#### Scenario: Publishing round two
- **WHEN** Luiz runs "Publish data" with round 2
- **THEN** the new version holds round 2 only, and its manifest says round 2

#### Scenario: Rio's recount
- **WHEN** TSE recounts Rio's round 1 after round 2 is published, and Luiz runs "Publish data" with round 1
- **THEN** a new round-1 version is written, and every round-2 version stays as it was
