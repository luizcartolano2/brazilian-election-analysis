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

A candidate page's list SHALL NOT be in its delivered HTML. It SHALL load from the same
values file as its map, when the page loads, folded under a summary that names its count
of municipalities. It SHALL appear once that file checks out, whether or not the map's
boundary file has arrived. Without JavaScript, a candidate page SHALL say that the map
and its list need JavaScript, and its delivered HTML SHALL still hold the candidate's
results, the six largest municipalities and, for President, the share in each state.

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
- **WHEN** a visitor opens a Governor candidate's page and its values file checks out
- **THEN** a folded summary names the state's count of municipalities, and opening it shows every municipality's votes and share for the candidate

#### Scenario: A list before the boundaries
- **WHEN** a candidate page's values file checks out and its boundary file has not arrived
- **THEN** the list is complete, and the map keeps its place until the boundary file arrives

#### Scenario: A candidacy with no column
- **WHEN** a candidacy's votes are under appeal, so its race's values file holds no column for it
- **THEN** the page shows no share map and no list, and requests no values file

### Requirement: Maps use only checked data
The build SHALL read each municipality's totals and the candidate registry from the
pinned data version, and check the files against the manifest. It SHALL check that the
municipalities add up to the area's summary for every candidate, every party's valid
candidate votes plus valid list votes, and the valid votes. A party list that TSE
annulled sub judice counts in neither side. The Brazil check SHALL include the
cities abroad, because the Brazil summary includes them. Any difference SHALL fail the
build, and the build SHALL NOT adjust a value.

The President map of each round's Brazil page, and every candidate page's share map,
SHALL read their values from a file that the build derived from those checked files. The
build SHALL name each file by the SHA-256 of its final bytes and serve it from the app's
own origin. A share map's file SHALL hold its race's votes by municipality for one area
and round, so that every candidate of that race reads the same file. The page SHALL carry
the file's address and SHA-256, and none of the file's rows, except the six largest
municipalities that a candidate page lists.

At run time, the app SHALL draw a map only after its boundary file arrives and its
SHA-256 matches the pin. Otherwise the map's place SHALL show a message in the visitor's
language, and the list SHALL stay. A map that reads its values from a file SHALL request
that file when the page loads, and SHALL draw only after the file arrives and its SHA-256
matches the page's. Otherwise the map SHALL show neither colors nor a list, SHALL say in
the visitor's language that its values failed to load, and SHALL offer a retry that
bypasses the browser's cache. When the file no longer exists, because the site was
deployed again, the map SHALL offer to reload the page instead.

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

#### Scenario: A retry past the cache
- **WHEN** a visitor retries a values file that failed its check
- **THEN** the browser requests the file again from the site, not from its cache

#### Scenario: A file gone after a deploy
- **WHEN** a page opened before a deploy requests a values file that the new deployment no longer serves
- **THEN** the map says that the site was updated, and offers to reload the page

#### Scenario: The Brazil pages' weight
- **WHEN** a visitor opens the round-1 or the round-2 Brazil page
- **THEN** the page's HTML holds its President map's file address and SHA-256, and no municipality's values

### Requirement: Pages stay light enough for a phone
No page in the static export SHALL exceed 2.5 MB, counting its HTML and every values file
that it loads. The build or CI SHALL fail when one does.

#### Scenario: A page grows too large
- **WHEN** a change makes any exported page larger than 2.5 MB, counting its values files
- **THEN** CI fails and names the page, its HTML's size and each values file's size

#### Scenario: A finalist's page
- **WHEN** the build measures a President finalist's page, which loads a values file for each round
- **THEN** the page's size is its HTML plus both values files
