## MODIFIED Requirements

### Requirement: Addresses accept only valid values
The app SHALL accept a state code only from the 27 states and `zz`, a race only from the
races of the election, and municipality, zone and station numbers only as whole numbers
within their ranges. For any other value it SHALL show the error state. No value from the
address or from the search box SHALL reach a query or a file path except as a validated
value passed as a bound parameter. The playground SHALL be the one exception. Its editor
runs the SQL that a visitor writes or opens from a link, within the playground's limits.
Its own views name their files in their text, because a view takes no bound parameter, and
each name SHALL come from the build's file list. A playground link's data choice SHALL
pass the same checks as an address's values.

#### Scenario: A query injected in the address
- **WHEN** a visitor opens a station address whose municipality value contains SQL text
- **THEN** the page shows the error state and runs no query

#### Scenario: A path in the state code
- **WHEN** a visitor opens an address whose state code contains a slash or `..`
- **THEN** the page shows the error state and requests no file

#### Scenario: Quotes in the search box
- **WHEN** a visitor searches for a place name that contains quote characters
- **THEN** the search treats them as text and returns matching places or none

#### Scenario: SQL in a playground link's data choice
- **WHEN** a visitor opens a playground link whose state code holds SQL text
- **THEN** the playground restores no part of the link and requests no file
