## Purpose

Turns TSE's published files for one election round into a reconciled, privacy-safe
dataset of official results per polling station, which the explorer and later analyses
read without touching TSE directly.

## ADDED Requirements

### Requirement: Source files are recorded
The pipeline SHALL read only TSE files from a fixed list of sources for the requested
round: votes per polling station for every race, turnout per polling station, candidates,
polling places, the municipality list with IBGE codes, and TSE's own aggregate results.
For every file it reads, it SHALL record the URL, the SHA-512 of the bytes it read, and
the time of the download.

#### Scenario: Every source is recorded
- **WHEN** a pipeline run completes
- **THEN** its output lists each source file with its URL, SHA-512 and download time

#### Scenario: A source is unavailable
- **WHEN** any listed source cannot be downloaded completely
- **THEN** the run fails with a message naming that source, and writes no output

### Requirement: Candidate personal identifiers never leave the pipeline
The pipeline SHALL keep only an allowlist of candidate fields: election, round, race,
state, candidate number, ballot name, party, federation, coalition, candidacy status and
round outcome. It SHALL NOT output CPF, voter-ID number, email, birth date or any other
personal identifier, even though TSE publishes some of them unmasked.

#### Scenario: Output is restricted to the allowlist
- **WHEN** the candidate output is written
- **THEN** its columns are exactly the allowlisted fields

#### Scenario: A forbidden field is about to be written
- **WHEN** any output would contain a column named for CPF, voter ID, email or birth date
- **THEN** the run fails before writing

### Requirement: Votes per polling station
The dataset SHALL contain, for every polling station with results and every race, the
votes for each candidate number, with party-list votes, blank votes and null votes each
identifiable as their own vote type.

#### Scenario: Blank and null votes are distinguishable
- **WHEN** a polling station's rows for a race are read
- **THEN** blank votes and null votes appear as their own vote types, never as a candidate

#### Scenario: Party-list votes in a proportional race
- **WHEN** a voter chose only a party in a race for deputy
- **THEN** that vote appears as a party-list vote for that party

### Requirement: Votes for an invalid candidacy are technical nulls
A number can be on the ballot while TSE does not count its candidacy as valid. In the
2026 presidential race, number 28 received 5,246 votes that TSE counts as technical nulls
("nulos técnicos"). The dataset SHALL classify votes the way TSE's aggregate does: votes
for a number that TSE does not count as a valid candidacy are technical nulls, kept apart
from both candidate votes and ordinary null votes.

#### Scenario: A number with an invalid candidacy
- **WHEN** a polling station has votes for a number that TSE does not count as a valid candidacy
- **THEN** the dataset records them as technical nulls, not as votes for a candidate

#### Scenario: The number is not presented as a candidate
- **WHEN** the candidate output is read
- **THEN** a number whose votes are all technical nulls carries its TSE status, so a consumer does not list it as a competing candidate

### Requirement: Turnout per polling station
The dataset SHALL contain, for every polling station with results and every race, the
number of eligible voters, the attendance, the abstentions, and the counts of nominal,
party-list, blank and null votes.

#### Scenario: Turnout is available for a station
- **WHEN** a polling station and a race are looked up
- **THEN** eligible voters, attendance, abstentions and each vote count are returned

### Requirement: Aggregated polling stations point to their principal
TSE can aggregate a small polling station onto another station's voting machine. The
dataset SHALL list every aggregated station with the principal station that counts its
votes, and SHALL NOT invent results rows for an aggregated station.

#### Scenario: An aggregated station is looked up
- **WHEN** a station that TSE marks as aggregated is looked up
- **THEN** the dataset returns its principal station and no results of its own

### Requirement: Polling places with location
The dataset SHALL contain, for every polling station, its polling place's name, address,
neighborhood, and the latitude and longitude that TSE publishes.

#### Scenario: A station's place is looked up
- **WHEN** a polling station is looked up
- **THEN** its polling place name, address, neighborhood and coordinates are returned

### Requirement: Official numbers reconcile, or nothing is written
The pipeline SHALL fail, and write no output, unless both checks pass for every race:
the votes in each polling station equal its attendance multiplied by the number of
choices each voter makes in that race, and the total per candidate for Brazil and for
each state equals TSE's published aggregate. The pipeline SHALL NOT drop or adjust rows
to make the checks pass.

#### Scenario: A station's votes do not match its attendance
- **WHEN** a polling station's votes in a race differ from its attendance multiplied by the choices per voter
- **THEN** the run fails and reports the station, the race and both numbers

#### Scenario: Two senate seats
- **WHEN** the race elects two senators, so each voter makes two choices
- **THEN** a station's senate votes are checked against twice its attendance

#### Scenario: A total differs from TSE's aggregate
- **WHEN** a candidate's summed votes for a state differ from TSE's published total
- **THEN** the run fails and reports the candidate, the state and both numbers

#### Scenario: Technical nulls reconcile on their own
- **WHEN** the totals for Brazil or a state are checked
- **THEN** blank votes, null votes and technical nulls each equal TSE's published total for that kind of vote

### Requirement: Data for one state and race stands alone
The dataset SHALL be organized so that one race in one state can be read without
reading any other state's data. Presidential results SHALL also be readable for Brazil
as a whole, including votes cast abroad.

#### Scenario: Reading one state's governor race
- **WHEN** a consumer reads the governor race for one state
- **THEN** it needs no file that holds another state's data

### Requirement: Summaries for fast first display
The pipeline SHALL write small summary files with the totals of each race for Brazil,
for each state and for each municipality, so a page can show headline numbers without
querying polling-station data.

#### Scenario: A state summary is read
- **WHEN** a consumer reads the summary for one state
- **THEN** it gets each race's totals per candidate, blank, null and turnout for that state

### Requirement: Same inputs, same outputs
Two runs over identical source files SHALL produce byte-identical output files.

#### Scenario: Rerun on the same sources
- **WHEN** the pipeline runs twice on source files with the same SHA-512 values
- **THEN** every output file has the same checksum in both runs
