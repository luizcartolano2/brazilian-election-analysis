# results-maps Specification

## Purpose

Shows where each candidate led and how strongly, by municipality, on the Brazil, state,
race and candidate pages, with every color also readable as text.

## Requirements

### Requirement: Maps on the Brazil, state and race pages
The Brazil page SHALL map the President race by municipality. Each state page SHALL map
its Governor race by municipality, and each race page SHALL map its own race. A page
whose area has only one municipality, such as the Federal District, SHALL show no map.
Votes cast abroad SHALL NOT appear on any map. The Brazil map SHALL link to the abroad
page instead. Pernambuco's maps SHALL draw Fernando de Noronha in an inset, because the
island lies far off the coast.

#### Scenario: The Brazil page
- **WHEN** a visitor opens the Brazil page
- **THEN** a map shows the President race for every municipality in Brazil, and a link leads to the votes cast abroad

#### Scenario: A state's race page
- **WHEN** a visitor opens the Senate race page for a state
- **THEN** a map shows that state's municipalities colored for the Senate race

#### Scenario: The Federal District
- **WHEN** a visitor opens the Federal District's page
- **THEN** no map is shown, because the district has one municipality

### Requirement: Colors show the most voted
On a President or Governor map, each municipality SHALL take the color of its most voted
candidate. On a deputy map, it SHALL take the color of the federation with the most
votes there, or of the party where a party runs outside any federation. A federation's
votes are the valid candidate votes and the list votes of its parties. The two
candidates, federations or parties with the most votes in the race's whole area SHALL
each have a color, and every other one SHALL share one gray. That area is Brazil for
President and the state for every other race, so a candidate keeps one color on every
map of a race. A municipality where two or more lead with the same votes SHALL take a
separate tie style.

On these maps the margin is the leader's share of valid votes minus the runner-up's
share, in percentage points. It SHALL set the shade in three bins: under 5 points, from
5 to under 20 points, and 20 points or more. Each bin SHALL have a name in each
language.

On a Senate map, each municipality SHALL take the color of its most voted candidate in
one shade, with no margin bins, because each voter chose two candidates and two win.

#### Scenario: A municipality led by a minor candidate
- **WHEN** the most voted candidate in a municipality is not among the race's top two
- **THEN** the municipality is gray, and its details name that candidate

#### Scenario: The President race on a state page
- **WHEN** a visitor opens the President map of a state where a third candidate came second
- **THEN** the two colors still belong to the two most voted candidates in Brazil, and the state's runner-up is gray

#### Scenario: A close municipality
- **WHEN** the leader's share exceeds the runner-up's by 3.2 percentage points on a Governor map
- **THEN** the municipality takes the lightest shade of the leader's color

#### Scenario: A tie
- **WHEN** two candidates have the same votes and lead a municipality
- **THEN** the municipality takes the tie style, and its details say that it is a tie

#### Scenario: A deputy race
- **WHEN** a visitor opens the map of a state's federal deputy race
- **THEN** each municipality shows the federation, or the party outside any federation, with the most valid candidate votes plus list votes there

#### Scenario: A Senate race
- **WHEN** a visitor opens a Senate map
- **THEN** each municipality shows its most voted candidate in one shade, and the map states that each voter chose two candidates for two seats

### Requirement: The legend and the credits are part of the map
Each map SHALL hold, inside its own frame, the race, the area, the round, its legend and
the credits to TSE and to IBGE. The legend of a most-voted map SHALL say that colors
show the most voted in each municipality, and SHALL name the margin bins where the map
has them. The legend of a share map SHALL name its steps and say that shares are of
valid votes. A Senate map's frame SHALL state that each voter chose two candidates. A
screenshot of the map alone SHALL show all of them.

#### Scenario: A cropped screenshot
- **WHEN** someone captures only the frame of a Governor map
- **THEN** the capture shows the race, the area, the round, the legend with the bin names, the statement about the most voted, and both credits

#### Scenario: A cropped share map
- **WHEN** someone captures only the frame of a Senate candidate's share map
- **THEN** the capture shows the candidate, the area, the round, the steps, that shares are of valid votes, that each voter chose two, and both credits

### Requirement: A map has no basemap and keeps the page scrollable
Maps SHALL draw municipality boundaries only, with no street or terrain basemap. They
SHALL offer no pan and no zoom. On a touch screen, a swipe that starts on a map SHALL
scroll the page. A map SHALL fit a 360-pixel-wide screen without horizontal scrolling.

#### Scenario: Scrolling past a map on a phone
- **WHEN** a visitor on a phone swipes upward with a finger on the map
- **THEN** the page scrolls

#### Scenario: A narrow screen
- **WHEN** a mapped page is opened at 360 pixels wide
- **THEN** the whole map is visible, and the page needs no horizontal scrolling

### Requirement: A municipality's details and its view
When a pointer rests on a municipality, or a finger taps it, the map SHALL show the
municipality's details. On a most-voted map, the details are its name, its most voted
and, where the map has bins, the margin. On a Senate map, they are its name and its two
most voted candidates with their shares. On a share map, they are its name and the
candidate's votes and share. A click on a municipality SHALL open that municipality's
view for the race shown. On a touch screen, the details SHALL hold a link to that view.

#### Scenario: Clicking a municipality
- **WHEN** a visitor clicks Recife on the Governor map of Pernambuco
- **THEN** the municipality view of Recife opens on the Governor race

#### Scenario: Tapping a municipality
- **WHEN** a visitor taps a municipality on a phone
- **THEN** its details appear, with a link to its view

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
deployed again, the map SHALL offer to reload the page instead. Reusing a boundary or
values file that passed the same SHA-256 check earlier in the visit SHALL count as
requesting it.

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

#### Scenario: One file for several maps
- **WHEN** a finalist's round-2 share map and swing map read the same values file
- **THEN** the browser requests and checks that file once, and both maps draw from it

### Requirement: A page for each majoritarian candidacy
Each candidacy in the pinned summaries for President, Governor or Senate SHALL have a
static page in each language, at an address built from its area, race and ballot
number. The page SHALL show the candidate's ballot name, number, party, votes and TSE's
outcome for the area. A candidacy with valid votes SHALL also show its share of valid
votes and its place in the race by votes, and map that share by municipality. The steps
are 10 percentage points up to 50 or more for President and Governor, and 5 points up to
25 or more for the Senate, because each Senate voter chose two candidates. A candidacy
whose votes TSE annulled sub judice SHALL show its votes as under appeal, with TSE's
status, no place in the race and no share map. In an area with one municipality, the
page SHALL show no share map. A President candidate's page SHALL say that its map leaves
out the votes cast abroad, and link to them. Every results table of a President, Governor
or Senate race SHALL link each candidate to their page.

Below the map, a candidacy with valid votes SHALL list up to six municipalities of its
area, those with the most valid votes, with the candidate's share in each. In an area
with one municipality, the page shows no such list. A President candidate's page SHALL
also list the candidate's share in each state, from the highest to the lowest, and SHALL
state in how many states the candidate was the most voted. Each state in that list SHALL
link to the state's page.

#### Scenario: A governor candidate
- **WHEN** a visitor opens the page of a Governor candidate in Bahia
- **THEN** it shows the candidate's results in Bahia and a map of their share in each Bahian municipality

#### Scenario: A President candidate
- **WHEN** a visitor opens the page of a President candidate
- **THEN** it shows the candidate's results for Brazil and a map of their share in every municipality

#### Scenario: Sharing a candidate page
- **WHEN** a visitor copies a candidate page's address and opens it elsewhere
- **THEN** the same candidate's page opens

#### Scenario: Votes under appeal
- **WHEN** a Senate candidacy's destination in TSE's aggregate is "Anulado sub judice"
- **THEN** its page shows its votes as under appeal with that status, and draws no share map

#### Scenario: A President candidate's states
- **WHEN** a visitor opens the page of a President candidate who was the most voted in 12 states
- **THEN** the page states 12 states, and lists the candidate's share in all 27 states from the highest to the lowest

#### Scenario: An area with one municipality
- **WHEN** a visitor opens the page of a Governor candidate in the Federal District
- **THEN** the page shows neither a share map nor a list of municipalities

#### Scenario: The largest municipalities
- **WHEN** a visitor opens the page of a Governor candidate in São Paulo
- **THEN** the page lists the six São Paulo municipalities with the most valid votes, with the candidate's share in each

### Requirement: Pages stay light enough for a phone
No page in the static export SHALL exceed 2.5 MB, counting its HTML and every values file
that it loads. The build or CI SHALL fail when one does.

#### Scenario: A page grows too large
- **WHEN** a change makes any exported page larger than 2.5 MB, counting its values files
- **THEN** CI fails and names the page, its HTML's size and each values file's size

#### Scenario: A finalist's page
- **WHEN** the build measures a President finalist's page, which loads a values file for each round
- **THEN** the page's size is its HTML plus both values files

### Requirement: A candidate keeps the map's color on the whole page
Wherever a page marks a candidate of a President, Governor or Senate race with a color
outside a map, such as a card, a share bar, a legend or a state tile, it SHALL use the
color that the candidate has on that race's maps. The most voted in the race's whole
area takes the first map color, the runner-up takes the second, and every other
candidate takes the gray. The race's whole area is Brazil for President and the state
for every other race. In round 2, each finalist SHALL keep the color of its round-1
ranking, on maps and everywhere else. A color SHALL never be the only mark of a
candidate: a name or a legend next to it SHALL name the candidate.

#### Scenario: The President race on a state page
- **WHEN** the most voted President candidate in a state came second in Brazil
- **THEN** that candidate's card on the state page takes the second map color, as on the President maps

#### Scenario: A third candidate
- **WHEN** a Senate card shows the third most voted candidate in the state
- **THEN** the card's color mark is the gray that the maps use for every other candidate

#### Scenario: The runner-up of round one wins round two
- **WHEN** the second most voted President candidate of round 1 is the most voted in round 2
- **THEN** that candidate keeps the second map color on every round-2 page and map

### Requirement: The closest municipalities
The Governor tab of a state page SHALL list the five municipalities where the margin
between the two most voted Governor candidates is smallest. Each row SHALL name the
municipality, both candidates and the margin in percentage points, and SHALL link to the
municipality's view. A tie SHALL show as a tie, with a margin of zero. The list SHALL use
the same municipality values as the state's Governor map. A state with fewer than two
municipalities shows no list.

#### Scenario: A close Governor race in a municipality
- **WHEN** a municipality's two most voted Governor candidates are 0.2 points apart, the smallest margin in the state
- **THEN** it is the first row of the list, with both names and "0,2 p.p." on the Portuguese page

#### Scenario: A tie
- **WHEN** two Governor candidates have the same votes in a municipality
- **THEN** the municipality appears in the list as a tie

### Requirement: Round-two maps
The round-2 Brazil page SHALL map the round-2 President race by municipality. Each
round-2 state page SHALL map its President race and, in a state with a Governor runoff,
its Governor race. Each round-2 race page SHALL map its own race. Round-2 maps SHALL
follow the rules of round-1 maps: the margin bins, the legend and credits in the frame,
the text equivalent, the checks against the pinned version, and no map for an area with
one municipality or for the votes cast abroad.

#### Scenario: A Governor runoff state
- **WHEN** a visitor opens the round-2 page of Espírito Santo
- **THEN** maps show the President and the Governor runoffs by municipality, each with its list of municipalities

#### Scenario: The Federal District in round two
- **WHEN** a visitor opens the round-2 page of the Federal District
- **THEN** no map is shown, because the district has one municipality

### Requirement: A finalist's page carries both rounds
Once round 2 is pinned, a finalist's candidate page SHALL show a round-2 section above
its round-1 results: the round-2 votes, share of valid votes and TSE's outcome, the
round-2 share map, and the round-2 largest municipalities. A President finalist's
round-2 section SHALL also show, as in round 1, the share in each state with a link to
that state's round-2 page, the count of states led, and the note that its map leaves out
the votes cast abroad, with a link to round 2's votes abroad. In an area with one
municipality, the round-2 section SHALL show no map and no list of municipalities, as in
round 1. The page's address SHALL NOT change. A
candidate who was not a finalist SHALL show round 1 only.

#### Scenario: Lula's page after the runoff
- **WHEN** round 2 is pinned and a visitor opens `/2026/presidente/13/`
- **THEN** the page shows Lula's round-2 results and share map first, and the round-1 results below

#### Scenario: A Federal District finalist
- **WHEN** round 2 is pinned and a visitor opens the page of a Governor finalist in the Federal District
- **THEN** the round-2 section shows the votes, share and outcome, with no map and no list of municipalities

#### Scenario: A candidate eliminated in round one
- **WHEN** a visitor opens the page of a President candidate who was not a finalist
- **THEN** the page shows round 1 only

### Requirement: A finalist's swing between the rounds
A finalist's round-2 section SHALL show a swing map below its round-2 share map when all of
these hold: round 2 is in the build, neither round's data version is marked synthetic,
both finalists' votes are valid in both rounds' summaries, and both rounds' values files
for the area list the same municipalities. Otherwise the section SHALL show no swing map.
A fixtures build that sets the fixtures-only swing switch SHALL lift the rule on synthetic
data, and no other build SHALL accept that switch.

A finalist's head-to-head share in a municipality SHALL be its votes divided by the two
finalists' combined votes in one round. The swing SHALL be the round-2 head-to-head share
minus the round-1 head-to-head share, in percentage points, rounded to one decimal. One
finalist's swing SHALL equal the other finalist's swing with the opposite sign.

The map SHALL color a municipality by its rounded swing in seven steps: under 1 point in
either direction, from 1 to under 3, from 3 to under 6, and 6 or more, in each direction.
The edges SHALL apply to the swing's absolute value, so swings of +1.0 and −1.0 take the
same step on opposite sides. A municipality where the two finalists had no votes in a round
SHALL have no swing, and SHALL take a hatched no-data fill that no step uses.

The swing map SHALL read the same values files as the section's share maps, one per round,
and SHALL draw only after both files arrive and their SHA-256 values match the page's.
Otherwise it SHALL follow a share map's rules: no colors and no list, a message in the
visitor's language, a retry that bypasses the browser's cache, and an offer to reload the
page when a file no longer exists. As with a share map, an area with one municipality
SHALL get no swing map.

Pointing at or tapping a municipality SHALL show its name, the finalist's share of the two
finalists' votes in each round, and the swing. Clicking it SHALL open that municipality's
round-2 view for the race.

A folded list SHALL follow the swing map, with a summary that names its count of
municipalities. Each row SHALL show the municipality's head-to-head share in each round and
the swing. A visitor SHALL be able to sort the list by name or by swing, and to filter it by
part of a name, ignoring case and accents. Without JavaScript, the page SHALL say that the
swing map and its list need JavaScript.

#### Scenario: Lula's swing map
- **WHEN** round 2 is pinned and a visitor opens `/2026/presidente/13/`
- **THEN** the round-2 section shows, below the round-2 share map, a map of Lula's change in head-to-head share by municipality, followed by its folded list

#### Scenario: The two finalists mirror each other
- **WHEN** a visitor compares the two President finalists' swing maps
- **THEN** each municipality shows the same size of change on both maps, with opposite signs, in mirrored steps

#### Scenario: A swing on a step's edge
- **WHEN** a municipality's rounded swing is +1.0 for one finalist and −1.0 for the other
- **THEN** both maps put it in the step from 1 to under 3 points, on opposite sides of zero

#### Scenario: A Governor runoff
- **WHEN** round 2 is pinned and a visitor opens the page of a Governor finalist in a state with a runoff
- **THEN** the round-2 section shows a swing map of that state's municipalities

#### Scenario: A finalist in the Federal District
- **WHEN** a visitor opens the page of a Governor finalist in the Federal District
- **THEN** the round-2 section shows no swing map, because the district has one municipality

#### Scenario: A finalist's votes under appeal
- **WHEN** TSE annuls one finalist's round-2 votes sub judice
- **THEN** neither finalist's page shows a swing map

#### Scenario: Rounds that list different municipalities
- **WHEN** a race's round-1 and round-2 values files for an area list different municipalities
- **THEN** neither finalist's page shows a swing map for that area, and the build prints the municipality codes that differ

#### Scenario: No votes for the finalists
- **WHEN** the two finalists had no votes in a municipality in round 1
- **THEN** that municipality takes the hatched no-data fill, apart from every step, and its row in the list says that the finalists had no votes in round 1

#### Scenario: The synthetic round two
- **WHEN** a build pins the synthetic round 2 without the fixtures-only swing switch
- **THEN** no finalist's page shows a swing map

#### Scenario: The swing switch outside the fixtures
- **WHEN** a build that reads a pinned data version sets the fixtures-only swing switch
- **THEN** the build fails before it writes any page

#### Scenario: A municipality's details
- **WHEN** a visitor points at a municipality on Lula's swing map
- **THEN** the details show the municipality, Lula's share of the two finalists' votes in round 1 and in round 2, and the swing

#### Scenario: Clicking a municipality
- **WHEN** a visitor clicks a municipality on a swing map
- **THEN** the page opens that municipality's round-2 view for the race

#### Scenario: The page's weight
- **WHEN** the page size gate measures a finalist's page with a swing map
- **THEN** the page counts the same values files as without the swing map, plus the section's HTML

#### Scenario: A values file that fails
- **WHEN** one of the two values files arrives with a SHA-256 that differs from the page's
- **THEN** the swing map shows neither colors nor a list, says that its values failed to load, and offers a retry

#### Scenario: Sorting by swing
- **WHEN** a visitor sorts the swing list by swing
- **THEN** the municipalities appear from the largest gain to the largest loss, and municipalities with no swing come last

### Requirement: The swing map says what it compares
The swing map SHALL hold, inside its own frame: the finalist, the race, the area, both
rounds, a legend with the seven signed steps and the no-data fill, and the credits to TSE
and to IBGE. The frame SHALL state that the map compares two official counts of the two
finalists' votes. It SHALL state that a change mixes differences in turnout, the round-1
votes of the eliminated candidates, and votes that changed between the finalists, and that
TSE's files cannot separate them. It SHALL state that the map does not show where any
voter's vote went.

Each label of a head-to-head share, in the frame, the details and the list, SHALL name its
denominator as the two finalists' votes. No such label SHALL call it a share of the valid
votes. The palette SHALL be centered on zero, with a neutral middle step, and SHALL use
neither of the two candidate colors. No heading, frame, detail or list of the swing map SHALL
say that a vote went from one candidate to another, or estimate where any voter's vote
went.

#### Scenario: A cropped swing map
- **WHEN** someone captures only the frame of a Governor finalist's swing map
- **THEN** the capture shows the finalist, the Governor race, the state, both rounds, the seven steps and the no-data fill, the statements about what the map compares and does not show, and both credits

#### Scenario: Labels that name the denominator
- **WHEN** a visitor reads the swing list's column headers or a municipality's details
- **THEN** each share reads as a share of the two finalists' votes, and none reads as a share of the valid votes

#### Scenario: A gain with no attribution
- **WHEN** the swing map shows a finalist's gain in a municipality
- **THEN** neither the heading, the frame, the details nor the list attributes the gain to any other candidate's voters
