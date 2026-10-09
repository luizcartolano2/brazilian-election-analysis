# site-search Specification

## Purpose

Lets a visitor reach any municipality, city abroad or candidacy from any page by typing
part of its name, without knowing which state or race page holds it.

## Requirements

### Requirement: A search box on every page
Every page except the page for an unknown address SHALL offer a search box that finds
municipalities, cities abroad and every candidacy in the pinned summaries. The summaries
leave out Fernando de Noronha's Conselheiro Distrital race, so its candidacies are not in
the search. A municipality result SHALL name its state. A candidacy result SHALL show the
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

### Requirement: Where a result leads
A municipality result SHALL open that municipality's view. A city abroad SHALL open its
view. A candidacy for President, Governor or Senate SHALL open its candidate page. A
deputy candidacy SHALL open its race page, scrolled to its row.

#### Scenario: A deputy candidate
- **WHEN** a visitor chooses a state deputy candidacy from the results
- **THEN** the state deputy race page of that state opens with the candidacy's row in view

#### Scenario: A Senate candidate
- **WHEN** a visitor chooses a Senate candidacy from the results
- **THEN** that candidacy's page opens

### Requirement: The index holds public fields only
The search index SHALL come from the pinned, verified summaries and municipality list
at build time. It SHALL hold, for a candidacy, only its ballot name, number, party,
race, area, outcome and votes. For a municipality, it SHALL hold only the name, state,
TSE code and whether it is a capital. It SHALL NOT hold any personal identifier, such as
a CPF, voter-ID number, email or birth date.

#### Scenario: Checking the index
- **WHEN** the build writes the search index
- **THEN** a test fails if any entry holds a field outside the allowed ones

### Requirement: The index loads only when needed
A page SHALL NOT download the search index when it loads. The index SHALL download the
first time a visitor focuses the search box.

#### Scenario: A page view without search
- **WHEN** a visitor opens a page and never touches the search box
- **THEN** the browser requests no search index

### Requirement: Search works with a keyboard and a screen reader
A visitor SHALL be able to type, move through the results with the arrow keys, open one
with Enter, and close the list with Escape. A screen reader SHALL announce the number of
results. The results SHALL use the visitor's language for race and state names. Names
of municipalities, cities abroad and candidates show in title case, by the same rule as
every other page.

#### Scenario: Keyboard only
- **WHEN** a visitor types a name, presses the down arrow twice and then Enter
- **THEN** the second result opens

#### Scenario: English race names
- **WHEN** a visitor on an English page finds a Senate candidacy
- **THEN** the result names the race "Senator"

#### Scenario: Without JavaScript
- **WHEN** a page is loaded with JavaScript disabled
- **THEN** no search box is shown, and the page still links to the Brazil page, which lists every state

#### Scenario: Names in a result
- **WHEN** a visitor searches for "abreu"
- **THEN** the result shows the municipality as "Abreu e Lima", not in TSE's capitals
