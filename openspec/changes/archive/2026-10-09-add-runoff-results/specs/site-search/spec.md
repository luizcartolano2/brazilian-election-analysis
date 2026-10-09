## MODIFIED Requirements

### Requirement: A search box on every page
Every page except the page for an unknown address SHALL offer a search box that finds
municipalities, cities abroad and every candidacy in round 1's pinned summaries. The
summaries leave out Fernando de Noronha's Conselheiro Distrital race, so its candidacies
are not in the search. Round 2 adds no entry, so a candidacy shows TSE's round-1 outcome
even after round 2 is pinned. A municipality result SHALL name its state. A candidacy result SHALL show the
ballot name, number, party, race, area and TSE's outcome. Each President candidacy SHALL
appear once, for Brazil. Matching SHALL start at two typed characters, SHALL ignore
case and accents, and SHALL accept part of a name. A candidacy SHALL also match its full
ballot number. The list SHALL show at most 20 results, and SHALL say when more match. A
full ballot number SHALL list every candidacy that holds it, even past 20, because each
state numbers its own candidacies.

#### Scenario: A name without accents
- **WHEN** a visitor types "sao jose"
- **THEN** municipalities whose names hold "São José" show, each with its state
- **AND** a note says that more match, because more than 20 municipalities hold that name

#### Scenario: A city abroad
- **WHEN** a visitor types "lisboa"
- **THEN** the results include Lisbon's votes abroad, under TSE's Portuguese name

#### Scenario: A ballot number
- **WHEN** a visitor types a deputy's full ballot number, which candidacies in 27 states hold
- **THEN** the results include every candidacy with that number, each with its state

#### Scenario: A President candidate
- **WHEN** a visitor types the ballot name of a President candidate
- **THEN** that candidacy appears once, for Brazil

#### Scenario: Characters with meaning elsewhere
- **WHEN** a visitor types quotes, `%`, `_` or `*`
- **THEN** they match only those characters in names

#### Scenario: Too many matches
- **WHEN** more than 20 entries match
- **THEN** 20 results show, with a note that more match

#### Scenario: A finalist after the runoff
- **WHEN** round 2 is pinned and a visitor types a President finalist's ballot name
- **THEN** that candidacy appears once, for Brazil, with TSE's round-1 outcome, and opens the candidate page that carries both rounds

### Requirement: The index holds public fields only
The search index SHALL come from round 1's pinned, verified summaries and municipality
list at build time. It SHALL hold, for a candidacy, only its ballot name, number, party,
race, area, outcome and votes. For a municipality, it SHALL hold only the name, state,
TSE code and whether it is a capital. It SHALL NOT hold any personal identifier, such as
a CPF, voter-ID number, email or birth date.

#### Scenario: Checking the index
- **WHEN** the build writes the search index
- **THEN** a test fails if any entry holds a field outside the allowed ones
