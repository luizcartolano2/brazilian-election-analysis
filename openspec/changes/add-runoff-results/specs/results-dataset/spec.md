## ADDED Requirements

### Requirement: Round two builds like round one
The pipeline SHALL build round 2 from the same TSE files as round 1, keeping only their
round-2 rows, with President under election code 6258 and the state races under 6260.
Round 2 has no municipal race. The states of a round-2 build SHALL come from TSE's
round-2 President municipality list, abroad included. A state's round-2 races SHALL come
from TSE's round-2 vote rows for that state, never from a written list, so a state with
no Governor runoff gets President only. Round 2 SHALL pass the same checks as round 1:
the allowlist of candidate columns, the classification of every vote by TSE's
destination, and reconciliation with TSE's aggregates.

#### Scenario: A state without a Governor runoff
- **WHEN** TSE's round-2 rows for a state hold President votes only
- **THEN** that state's round-2 summary holds the President race only

#### Scenario: Rio's runoff is cancelled
- **WHEN** a court ruling removes Rio's Governor runoff and TSE's round-2 rows for Rio hold President votes only
- **THEN** Rio's round-2 summary holds the President race only, with no change to the pipeline

#### Scenario: Round-two files that do not reconcile
- **WHEN** the station rows of round 2 do not add up to TSE's round-2 aggregates
- **THEN** the build fails and writes nothing
