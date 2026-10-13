## MODIFIED Requirements

### Requirement: Official numbers reconcile, or nothing is written
The pipeline SHALL fail, and write no output, unless every check below passes. It SHALL
NOT drop or adjust rows to make a check pass, and on failure it SHALL report every
mismatch, not only the first.

- Per polling station and race, the votes equal the attendance multiplied by the choices
  each voter makes, and the nominal, party-list, blank and null counts equal the
  station's turnout counts. The turnout file sorts votes by what was typed: any two-digit
  number in a deputy race is a party-list vote there, whatever its destination. The
  choices per voter are TSE's total votes for that race and area divided by its
  attendance. They are not the number of seats.
- Per municipality and zone, each candidate's votes equal TSE's published candidate
  totals for that municipality and zone.
- For each area that TSE publishes an aggregate for (Brazil and each state, and the
  municipality for a municipal election), each candidate's votes and each party's list
  votes equal the aggregate. So do the totals of valid, party-list, blank, null,
  technical-null, annulled and annulled sub judice votes.
- Per summary, every candidate, party-list, annulled and annulled sub judice vote falls
  on a named line, and the party table adds up to the valid votes.

Where TSE publishes no total to compare with, the figure SHALL be the sum of station
figures that passed the station checks.

The pipeline SHALL also fail at once, with no output, when an election in the round's
configuration has no vote rows in its municipality. It SHALL fail at once when a
candidate that TSE's aggregate omits matches no candidacy in the candidate file, matches
none by its ballot name among several, has two names or parties, or has no party. These
failures name the race and the number or the election, and nothing else. Brazil's
summary names only the candidates in Brazil's aggregate, so a President candidate that
Brazil's aggregate omits fails the summary check.

#### Scenario: A station's votes do not match its attendance
- **WHEN** a polling station's votes in a race differ from its attendance multiplied by the choices per voter
- **THEN** the run fails and reports the station, the race and both numbers

#### Scenario: Two senate seats, two choices
- **WHEN** TSE's senate totals equal twice the attendance, because each voter chose two senators
- **THEN** a station's senate votes are checked against twice its attendance

#### Scenario: A party with no list in the state
- **WHEN** voters type the number of a party that has no deputy list in that state
- **THEN** the totals count those votes as technical nulls, and the station check counts them as party-list votes, as TSE's turnout file does

#### Scenario: Seven council seats, one choice
- **WHEN** the Conselheiro Distrital race fills seven seats but each voter makes one choice
- **THEN** a station's council votes are checked against its attendance, not seven times it

#### Scenario: A municipality total differs
- **WHEN** a candidate's summed votes in a municipality and zone differ from TSE's published total for them
- **THEN** the run fails and reports the candidate, the municipality, the zone and both numbers

#### Scenario: An aggregate total differs
- **WHEN** a candidate's summed votes for a state differ from TSE's aggregate
- **THEN** the run fails and reports the candidate, the state and both numbers

#### Scenario: A party-list vote assigned to the wrong party
- **WHEN** a party's summed list votes for a state differ from TSE's aggregate for that party
- **THEN** the run fails and reports the party, the state and both numbers

#### Scenario: Each kind of vote reconciles on its own
- **WHEN** the totals for an area with a TSE aggregate are checked
- **THEN** valid, party-list, blank, null, technical-null, annulled and annulled sub judice votes each equal TSE's total for that kind of vote

#### Scenario: A vote with no named line
- **WHEN** a summary leaves votes under appeal on no candidate and no party list
- **THEN** the run fails and reports the area, the race and both numbers

#### Scenario: An election that vanishes from TSE's files
- **WHEN** TSE's files hold no vote rows for Fernando de Noronha's council, which round 1's configuration lists
- **THEN** the run fails at once, names the state, the election and the municipality, and writes nothing

#### Scenario: An omitted candidate with no party
- **WHEN** a candidate that TSE's aggregate omits has no party in the candidate file
- **THEN** the run fails and names the race and the candidate's number

#### Scenario: A President candidate that Brazil's aggregate omits
- **WHEN** the states' aggregates list a President candidate that Brazil's aggregate omits
- **THEN** the run fails with a summary mismatch for Brazil

### Requirement: Summaries for fast first display
The pipeline SHALL write small summary files with each race's totals for Brazil and for
each state, so those pages can show headline numbers without querying polling-station
data. It SHALL also write totals per municipality and per zone for each race and state,
including eligible voters, attendance, abstentions and each vote count.

Each race's summary SHALL name every candidate with votes in the area. A candidate that
TSE's aggregate omits, but its per-zone candidate file classifies, SHALL take its name
and destination from that file, its party from the candidate file, and no outcome. From
schema version 2 on, a party's `votos_candidatos` SHALL count only the votes of its
candidates whose destination is valid.

#### Scenario: A state summary is read
- **WHEN** a consumer reads the summary for one state
- **THEN** it gets each race's totals per candidate, each kind of invalid vote, and turnout for that state

#### Scenario: Municipality totals are read
- **WHEN** a consumer reads the municipality totals for one state and race
- **THEN** it gets every municipality's vote totals and turnout without reading polling-station data

#### Scenario: A candidate that the aggregate omits
- **WHEN** TSE's aggregate omits a candidacy under appeal that its per-zone file classifies
- **THEN** the state's summary names it, with its votes, its destination, its party and no outcome

#### Scenario: A party's candidate votes
- **WHEN** a party has a candidate whose votes TSE annulled sub judice
- **THEN** the party's `votos_candidatos` leaves that candidate's votes out, and the party table adds up to the valid votes
