## Purpose

Turns TSE's published files for one election round into a reconciled, privacy-safe
dataset of official results per polling station, which the explorer and later analyses
read without touching TSE directly.

## ADDED Requirements

### Requirement: Source files are recorded
The pipeline SHALL read only TSE files from a fixed list of sources for the requested
round, covering every election held that day. For the 2026 first round these are the
presidential election, the state election and the municipal election of Fernando de
Noronha. The sources are votes per polling station, turnout per polling station,
candidate totals per municipality and zone, candidates, polling places, the municipality
lists with IBGE codes, and TSE's aggregate results. For every file it reads, the pipeline
SHALL record the URL, the SHA-512 of the bytes it read, and the time of the download.

#### Scenario: Every source is recorded
- **WHEN** a pipeline run completes
- **THEN** its output lists each source file with its URL, SHA-512 and download time

#### Scenario: A source is unavailable
- **WHEN** any listed source cannot be downloaded completely
- **THEN** the run fails with a message naming that source, and writes no output

### Requirement: Candidate personal identifiers never leave the pipeline
The pipeline SHALL keep only an allowlist of candidate fields from TSE's candidate
registry: election, round, race, state, candidate number, ballot name, party, federation,
coalition and candidacy status. To these it SHALL add only the destination and outcome
that TSE's aggregate gives each candidate. It SHALL NOT output CPF, voter-ID number, email, birth date or any other personal
identifier, even though TSE publishes some of them unmasked. Personal identifiers SHALL
NOT appear in committed fixtures or in error messages either, because the repository and
its CI logs are public.

#### Scenario: Output is restricted to the allowlist
- **WHEN** the candidate output is written
- **THEN** its columns are exactly the allowlisted registry fields plus the destination and outcome from TSE's aggregate

#### Scenario: A forbidden field is about to be written
- **WHEN** any output would contain a column named for CPF, voter ID, email or birth date
- **THEN** the run fails before writing

#### Scenario: A candidate file fails to parse
- **WHEN** reading a candidate file raises an error
- **THEN** the message names the file, the line and the column, and contains no field values from that line

#### Scenario: A real CPF in a fixture or an output
- **WHEN** any committed fixture or any output file contains an 11-digit number whose CPF check digits are valid
- **THEN** the test suite fails

### Requirement: Votes per polling station
The dataset SHALL contain, for every polling station with results and every race, the
votes for each number typed, each with its vote type.

#### Scenario: Blank and null votes are distinguishable
- **WHEN** a polling station's rows for a race are read
- **THEN** blank votes and null votes appear as their own vote types, never as a candidate

#### Scenario: Party-list votes in a proportional race
- **WHEN** a voter chose only a party in a race for deputy
- **THEN** that vote appears as a party-list vote for that party

### Requirement: Votes are classified the way TSE classifies them
A number can be on the ballot while TSE does not count its votes as valid. The dataset
SHALL classify every vote with the destination that TSE's aggregate results give it, and
SHALL take each candidate's outcome from the same aggregate, not from the older candidate
registry. The vote types are: candidate, party list, blank, null, technical null,
annulled, and annulled sub judice. A number missing from the aggregate's list can still
have a destination in TSE's candidate totals per municipality and zone, and then that
destination applies. A number that neither source lists for that race and area is a
technical null. In the 2026 presidential race, number 28 received 5,246 such votes. A
destination value that the pipeline does not know SHALL fail the run.

#### Scenario: A number TSE does not list anywhere
- **WHEN** a polling station has votes for a number that neither TSE's aggregate nor its municipality-and-zone totals list for that race and area
- **THEN** the dataset records them as technical nulls, not as votes for a candidate

#### Scenario: A candidacy under appeal
- **WHEN** TSE's aggregate gives a candidate the destination "Anulado sub judice"
- **THEN** that candidate's votes are recorded as annulled sub judice, and do not count as valid

#### Scenario: A candidacy under appeal that the aggregate omits
- **WHEN** a number is missing from TSE's aggregate list but its municipality-and-zone totals give it the destination "Anulado sub judice"
- **THEN** its votes are recorded as annulled sub judice, not as technical nulls

#### Scenario: A party list under appeal
- **WHEN** TSE's aggregate gives a party the destination "Anulado sub judice" in a deputy race
- **THEN** that party's list votes are recorded as annulled sub judice, and do not count as valid

#### Scenario: An unknown destination
- **WHEN** TSE's aggregate gives a candidate or a party a destination the pipeline does not know
- **THEN** the run fails and names the race, the area, the number and the value

#### Scenario: The outcome comes from the aggregate
- **WHEN** the candidate registry and TSE's aggregate disagree about a candidate's outcome
- **THEN** the dataset carries the aggregate's outcome

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

Where TSE publishes no total to compare with, the figure SHALL be the sum of station
figures that passed the station checks.

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

### Requirement: Data for one state and race stands alone
The dataset SHALL be organized so that one race in one state can be read without
reading any other state's data. Presidential results SHALL also be readable for Brazil
as a whole, including votes cast abroad.

#### Scenario: Reading one state's governor race
- **WHEN** a consumer reads the governor race for one state
- **THEN** it needs no file that holds another state's data

### Requirement: Summaries for fast first display
The pipeline SHALL write small summary files with each race's totals for Brazil and for
each state, so those pages can show headline numbers without querying polling-station
data. It SHALL also write totals per municipality and per zone for each race and state.

#### Scenario: A state summary is read
- **WHEN** a consumer reads the summary for one state
- **THEN** it gets each race's totals per candidate, each kind of invalid vote, and turnout for that state

#### Scenario: Municipality totals are read
- **WHEN** a consumer reads the municipality totals for one state and race
- **THEN** it gets every municipality's totals without reading polling-station data

### Requirement: Same inputs, same data
Two runs over source files with the same checksums, using the same locked dependency
versions, SHALL produce byte-identical data files. The manifest is excluded, because it
records times and the commit.

#### Scenario: Rerun on the same sources
- **WHEN** the pipeline runs twice on source files with the same SHA-512 values and the same lockfile
- **THEN** every data file has the same checksum in both runs
