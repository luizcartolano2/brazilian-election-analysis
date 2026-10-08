## ADDED Requirements

### Requirement: Each page leads with its result
The Brazil page, each state page, the votes-abroad page, each race page and each
candidate page SHALL open with its result, before any map or table. A headline SHALL
state TSE's outcome, and the app SHALL NOT call a candidate elected or in the runoff
unless TSE's outcome says so. The headline takes the first form that applies:

1. In a proportional race where TSE elected at least one candidate, it states how many.
   Where TSE elected no one, it states the race and its seats, with no count.
2. In a majoritarian race where TSE sends candidates to the runoff, it names them.
3. In a majoritarian race where TSE elected candidates, it names them. A Senate race with
   two elected names both.
4. Otherwise, it names the most voted candidate as the most voted.

A candidate page's headline states that candidate's own outcome from TSE. Without an
elected or runoff outcome, it states the candidate's place in the race instead. For a
candidacy whose votes TSE annulled sub judice, it states TSE's status.

Below the headline, cards SHALL show the leading candidates of a majoritarian race: the
top two for President and Governor, and for the Senate the candidates that TSE elected
plus the next most voted. Each card SHALL show the ballot name, the party, the ballot
number, the share of valid votes, the votes and TSE's outcome, and SHALL link to the
candidate's page. A card for a candidate whom TSE sends to the runoff SHALL state the
runoff's date. A proportional race shows no cards. On the Brazil, votes-abroad and race
pages, the full results, the turnout and the map SHALL follow on the same page. The page
header SHALL name the round shown and its date, and SHALL link to the list of states on
the Brazil page.

#### Scenario: The Brazil page
- **WHEN** a visitor opens the Brazil page and TSE marks two President candidates for the runoff
- **THEN** the first heading names both as going to the runoff, and two cards show them before the map and the full results

#### Scenario: A Governor elected in the first round
- **WHEN** a visitor opens a state page where TSE marks one Governor candidate as elected
- **THEN** the headline names that candidate as elected

#### Scenario: A race with no outcome
- **WHEN** no candidate in a majoritarian race carries an elected or runoff outcome from TSE
- **THEN** the headline names the most voted candidate as the most voted, and calls no one elected

#### Scenario: A deputy race page
- **WHEN** a visitor opens a state's federal deputy race page
- **THEN** the headline states how many candidates TSE elected, and the page shows no candidate cards

#### Scenario: A deputy race with no one elected yet
- **WHEN** no candidate in a proportional race carries an elected outcome from TSE
- **THEN** the headline states the race and its seats, and no count of elected candidates

#### Scenario: The Senate
- **WHEN** a visitor opens a state's Senate results, where TSE elected two candidates
- **THEN** the headline names both elected candidates, and three cards show them and the next most voted

#### Scenario: A candidate page
- **WHEN** a visitor opens the page of a Governor candidate whom TSE marks as not elected
- **THEN** the headline states the candidate's place in the race, and calls the candidate neither elected nor in the runoff

#### Scenario: The runoff date
- **WHEN** a card shows a candidate whom TSE sends to the runoff
- **THEN** the card states that the runoff is on 25 October 2026, and the header names the first round and 4 October 2026

#### Scenario: The header's link to the states
- **WHEN** a visitor on a state page follows the header's link to the states
- **THEN** the Brazil page opens at its list of states

### Requirement: The states at a glance
The Brazil page SHALL show the 27 states as a grid of tiles, each placed at its rough
position on the map of Brazil. Each tile SHALL show the state's code and the share of
valid votes of its most voted President candidate. Each tile SHALL take that candidate's
map color, shaded by the same margin bins as the maps, and SHALL link to the state's
page. A legend SHALL name the colors and the bins, and the grid SHALL carry the TSE
credit. Under the grid, a list that opens on request SHALL name each state, its most
voted President candidate and that candidate's share, so the grid reads without color.
Each row of the list SHALL link to the state's President race page. A tile's accessible
name SHALL hold the same text as its row in the list.

#### Scenario: A state's tile
- **WHEN** the most voted President candidate in Pernambuco leads by more than 20 points
- **THEN** the PE tile shows the leader's share, takes the darkest shade of the leader's map color, and links to the Pernambuco page

#### Scenario: Reading the tiles without color
- **WHEN** a visitor cannot tell the tile colors apart and opens the list under the grid
- **THEN** the list names each state's most voted President candidate and share, and links each state to its President race page

### Requirement: A state page switches between its races
On a state page, the Governor, Senate and President races SHALL each be a tab. Each tab's
panel SHALL hold the race's headline, cards and turnout, and SHALL link to the race's own
page. The Governor panel SHALL also hold the Governor map, its list of municipalities and
the closest municipalities. The deputy races SHALL appear after the tabs as links to
their race pages, each with the count of candidates that TSE elected, when TSE elected
any. The page SHALL open on the Governor tab. When the address ends in a race's fragment,
for example `#senador`, the page SHALL open on that race's tab, and choosing a tab SHALL
set that fragment. The tabs SHALL work with a keyboard: the arrow keys move between tabs,
and a screen reader announces the tab list, the selected tab and its panel. Without
JavaScript, the page SHALL show every panel one after another, and each tab SHALL be a
link to its panel. When JavaScript runs but the tabs' script fails, choosing a tab SHALL
still show its panel. The votes-abroad page has one race and shows no tabs.

#### Scenario: Opening the Senate tab from a link
- **WHEN** a visitor opens a state page whose address ends in `#senador`
- **THEN** the Senate tab is selected and its panel shows

#### Scenario: Moving between tabs with the keyboard
- **WHEN** a keyboard user focuses the Governor tab and presses the right arrow
- **THEN** the Senate tab is selected and its panel shows

#### Scenario: A state page without JavaScript
- **WHEN** a state page is loaded with JavaScript disabled
- **THEN** the Governor, Senate and President panels all show, one after another

#### Scenario: The tabs' script fails
- **WHEN** JavaScript runs, the tabs' script fails to load, and a visitor chooses the Senate tab
- **THEN** the Senate panel shows

#### Scenario: The Federal District
- **WHEN** a visitor opens the Federal District's page
- **THEN** the deputy links offer federal deputy and district deputy, and no state deputy

#### Scenario: The votes-abroad page
- **WHEN** a visitor opens the votes-abroad page
- **THEN** it opens with the President headline and two cards, and shows no tabs

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

### Requirement: Fonts from the app's own origin
The app SHALL serve its fonts from its own origin, from font files that its build
includes. No page SHALL request a font or a stylesheet from any other host. While a font
loads, or when it fails to load, the text SHALL show in a system font.

#### Scenario: Loading a page under the production headers
- **WHEN** a visitor opens any page with the production headers applied
- **THEN** the browser requests no font or stylesheet from another host, and reports no security-policy violation

#### Scenario: A font fails to load
- **WHEN** a font file cannot be downloaded
- **THEN** the page shows its text in a system font

## MODIFIED Requirements

### Requirement: Headline numbers without JavaScript
The pages for Brazil and for each state SHALL contain their headline results in the
delivered HTML, so search engines and visitors without JavaScript see them. On a state
page, every race's panel SHALL be in the delivered HTML, including the panels of tabs
that are not selected. On the Brazil page, the state tiles and their text list SHALL be
in the delivered HTML.

#### Scenario: A state page without JavaScript
- **WHEN** a state page is loaded with JavaScript disabled
- **THEN** the leading candidates for that state's races and the turnout are readable

#### Scenario: A hidden tab in the delivered HTML
- **WHEN** a search engine reads a state page's HTML
- **THEN** the Senate and President panels hold their headlines and leading candidates, although the Governor tab is the one selected

#### Scenario: The state tiles without JavaScript
- **WHEN** the Brazil page is loaded with JavaScript disabled
- **THEN** the state tiles and the list of each state's most voted President candidate are readable

### Requirement: Usable on a phone
Every page SHALL work at 360 pixels wide without horizontal scrolling, and every number
shown in a chart SHALL also be available as text.

#### Scenario: A results table on a phone
- **WHEN** a results view is opened at 360 pixels wide
- **THEN** all candidates, votes and shares are readable without horizontal scrolling

#### Scenario: The state tiles on a phone
- **WHEN** the Brazil page is opened at 360 pixels wide
- **THEN** the whole grid of state tiles fits the screen, and each tile is at least 44 pixels wide

#### Scenario: The race tabs on a phone
- **WHEN** a state page is opened at 360 pixels wide
- **THEN** every tab is reachable without horizontal scrolling of the page
