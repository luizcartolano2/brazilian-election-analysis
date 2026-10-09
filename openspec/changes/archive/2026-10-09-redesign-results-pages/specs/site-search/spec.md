## MODIFIED Requirements

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
