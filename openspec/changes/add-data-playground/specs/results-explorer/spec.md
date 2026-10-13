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
- **THEN** the playground restores no part of the link and requests no Parquet file

### Requirement: Names in title case
The app SHALL show candidates' ballot names, municipality names and the names of cities
abroad in title case: each word starts with a capital letter and continues in lower
case. The Portuguese particles "da", "das", "de", "do", "dos" and "e" SHALL stay in
lower case unless they start the name, and so SHALL a "d" before an apostrophe, as in
"Pau d'Arco". A word with no vowel, such as PT or BH, SHALL keep its capitals, except
the abbreviated titles CMDT, DR, JR, PR, SGT and SR, which take title case. The vowels are
A, E, I, O, U and Y, with or without an accent. A Roman numeral of two letters or more,
written with I, V and X, such as II or XV, SHALL keep its capitals. An acronym that
holds a vowel SHALL keep its capitals when it is on a written list, which holds at least
PCO, PSOL, PSTU, CUT, ONG, SAMU and COHAB. Every other word takes title case, a party
name that is also a common word, such as NOVO, included. A letter after any character
that is neither a letter nor a digit, such as a hyphen, an apostrophe, a quote mark, a
parenthesis, a period or a slash, SHALL start in capitals. So a particle right after
such a character, as in "(DO POVO)", starts in capitals too.

The rule SHALL apply wherever one of these names appears, page titles, maps and search
results included. The app SHALL change only the case, never a letter, an accent or the
word order. The sources page SHALL say that TSE publishes these names in capitals and
that the site shows them in title case. Search SHALL find a name whatever the case of
the typed text.
A playground result SHALL show each text value as the query returns it, without changing
its case, because a visitor's query can compute or combine names, and so the table and
its CSV hold the same text.

#### Scenario: A two-word name
- **WHEN** TSE's ballot name is "FLAVIO BOLSONARO"
- **THEN** the site shows "Flavio Bolsonaro"

#### Scenario: A name with a particle
- **WHEN** TSE's ballot name is "MARIA DA SILVA"
- **THEN** the site shows "Maria da Silva"

#### Scenario: A name with a party abbreviation
- **WHEN** TSE's ballot names are "ZE DO PT", "BIA DO PSOL" and "LU DO NOVO"
- **THEN** the site shows "Ze do PT", "Bia do PSOL" and "Lu do Novo"

#### Scenario: An acronym with a vowel
- **WHEN** TSE's ballot name is "ZE DA ONG"
- **THEN** the site shows "Ze da ONG"

#### Scenario: An abbreviated title
- **WHEN** TSE's ballot names are "DR. ANA LIMA", "DR.ANA LIMA" and "PR. ANA LIMA"
- **THEN** the site shows "Dr. Ana Lima", "Dr.Ana Lima" and "Pr. Ana Lima"

#### Scenario: A Roman numeral
- **WHEN** TSE's municipality names are "PEDRO II" and "PIO IX"
- **THEN** the site shows "Pedro II" and "Pio IX"

#### Scenario: Two words joined by a slash
- **WHEN** TSE's ballot name is "LU ENFERMEIRA/PROFESSORA"
- **THEN** the site shows "Lu Enfermeira/Professora"

#### Scenario: Municipality names
- **WHEN** TSE's municipality names are "ABREU E LIMA" and "PAU D'ARCO"
- **THEN** the site shows "Abreu e Lima" and "Pau d'Arco"

#### Scenario: Searching in capitals
- **WHEN** a visitor types "FLAVIO" in the search box
- **THEN** the results include Flavio Bolsonaro's candidacy

#### Scenario: Names in a playground result
- **WHEN** a visitor's query in the playground returns municipality names
- **THEN** the result table and its CSV show each name as the published files hold it, in capitals
