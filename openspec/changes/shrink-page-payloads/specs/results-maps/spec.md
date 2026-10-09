## MODIFIED Requirements

### Requirement: Every color has a text equivalent
Each state and race page with a map SHALL list the mapped municipalities in its
delivered HTML. On a map with margin bins, each row SHALL show the municipality's most
voted, the margin in percentage points and the bin's name, and a visitor SHALL be able to
sort the list by name or by margin. On a Senate map, each row SHALL show the
municipality's two most voted candidates with their shares, and a visitor SHALL be able
to sort the list by name. A visitor SHALL be able to filter any list by part of a name,
ignoring case and accents. On the Brazil page, each state SHALL link to its
President race page, which lists that state's municipalities for the President race. A
candidate page with a share map SHALL list each municipality's votes and share for that
candidate, grouped by state on a President candidate's page, and a visitor SHALL be able
to sort that list by name or by share. A filter SHALL show its matches in every group.
A candidate page's list SHALL come with its map, from the same values file, and not in
its delivered HTML. Without JavaScript, a candidate page SHALL say that the map and its
list need JavaScript, and its delivered HTML SHALL still hold the candidate's results,
the six largest municipalities and, for President, the share in each state.

#### Scenario: The list without JavaScript
- **WHEN** a Governor race page is loaded with JavaScript disabled
- **THEN** the list shows every municipality with its most voted and margin, and the page says that the map needs JavaScript

#### Scenario: A Senate list
- **WHEN** a visitor opens a Senate race page
- **THEN** each row shows the municipality's two most voted candidates with their shares, with no margin, and the list sorts by name

#### Scenario: Sorting by margin
- **WHEN** a visitor sorts a state's list by margin
- **THEN** the municipalities appear from the closest margin to the widest

#### Scenario: Filtering without accents
- **WHEN** a visitor types "sao" in the filter of a list that holds "São Paulo"
- **THEN** the list keeps "São Paulo"

#### Scenario: The Brazil map's text
- **WHEN** a keyboard user on the Brazil page wants a municipality's President result
- **THEN** the state's link to its President race page leads to a list that holds it

#### Scenario: A candidate page without JavaScript
- **WHEN** a President candidate's page is loaded with JavaScript disabled
- **THEN** the page shows the candidate's results, the six largest municipalities and the share in each state, and says that the map and its list need JavaScript

#### Scenario: A candidate's list with JavaScript
- **WHEN** a visitor opens a Governor candidate's page and the values file loads
- **THEN** the share map and the list of every municipality's votes and share appear together

### Requirement: Maps use only checked data
The build SHALL read each municipality's totals and the candidate registry from the
pinned data version, and check the files against the manifest. It SHALL check that the
municipalities add up to the area's summary for every candidate, every party's valid
candidate votes plus valid list votes, and the valid votes. A party list that TSE
annulled sub judice counts in neither side. The Brazil check SHALL include the
cities abroad, because the Brazil summary includes them. Any difference SHALL fail the
build, and the build SHALL NOT adjust a value.

The Brazil page's President map and every candidate page's share map SHALL read their
values from a file that the build derived from those checked files. The build SHALL name
each file by its content and serve it from the app's own origin. A share map's file SHALL
hold its race's votes by municipality for one area and round, so that every candidate of
that race reads the same file. The page SHALL carry the file's address and SHA-256, and no
value of the file.

At run time, the app SHALL draw a map only after its boundary file arrives and its
SHA-256 matches the pin. Otherwise the map's place SHALL show a message in the visitor's
language, and the list SHALL stay. A map that reads its values from a file SHALL draw
only after that file arrives and its SHA-256 matches the page's. Otherwise the map SHALL
show neither colors nor a list, SHALL say in the visitor's language that its values failed
to load, and SHALL offer a retry.

#### Scenario: Totals that do not add up
- **WHEN** a candidate's votes summed over a state's municipalities differ from the state summary
- **THEN** the build fails and names the candidate, the state and both numbers

#### Scenario: Votes under appeal
- **WHEN** a state's federal deputy race holds candidates whose votes TSE annulled sub judice
- **THEN** the party check compares only the valid candidate votes plus list votes, and passes

#### Scenario: A party list under appeal
- **WHEN** a state's deputy race holds a party list whose destination is "Anulado sub judice"
- **THEN** the party check leaves that list's votes out on both sides, and passes

#### Scenario: The Brazil check
- **WHEN** the build checks the President race for Brazil
- **THEN** it sums every municipality and every city abroad before it compares with the Brazil summary

#### Scenario: Altered boundaries
- **WHEN** the boundary file that a browser receives differs from its pinned SHA-256
- **THEN** no map is drawn, a message says that the map did not load, and the list stays

#### Scenario: A failed boundary download
- **WHEN** the boundary file does not arrive, because the Worker fails or the visitor is offline
- **THEN** no map is drawn, a message says that the map did not load, and the list stays

#### Scenario: A municipality without a boundary
- **WHEN** a municipality in the data has no boundary in the pinned build
- **THEN** the build fails and names the municipality

#### Scenario: A values file that differs from its pin
- **WHEN** a candidate page's values file arrives with a SHA-256 that differs from the page's
- **THEN** the page shows neither the share map nor its list, says that the values failed to load, and offers a retry

#### Scenario: The Brazil page's weight
- **WHEN** a visitor opens the Brazil page
- **THEN** the page's HTML holds the President map's file address and SHA-256, and no municipality's values
