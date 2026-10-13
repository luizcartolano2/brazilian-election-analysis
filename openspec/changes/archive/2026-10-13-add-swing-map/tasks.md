## 1. Swing data

- [x] 1.1 In `web/src/lib/maps.ts`, build a finalist's swing rows from two rounds' `CandidateVotes`, joined on the TSE municipality code: each round's head-to-head share and the swing in points rounded to one decimal, or no swing where the two finalists had no votes in a round. Test the swing on in-memory files with real differences, the mirror between the two finalists, the no-data case, and a municipality that one file lacks, which throws
- [x] 1.2 Add the seven swing steps on the rounded swing's absolute value, ColorBrewer's seven-class PRGn and a hatched no-data pattern to `web/src/lib/map-colors.ts`. Test each step's edges, that +1.0 and −1.0 take mirrored steps, that no swing color equals a candidate shade, and that the no-data fill differs from every step
- [x] 1.3 In `web/scripts/prepare-data.ts`, compare each race's round-1 and round-2 values files for an area, print the municipality codes that differ, and record which races and areas can have a swing map. Test a pair that matches and a pair that differs by one municipality, which builds with no swing for that pair
- [x] 1.4 Add `ELEICOES_FIXTURE_SWING=1` to `prepare-data.ts`, which lifts the synthetic rule in fixtures mode and fails the build in any other mode before it writes a page. Test both modes

## 2. Swing map

- [x] 2.1 Give `race-map.tsx` a module-level cache of checked, parsed boundary and values files, keyed by address and SHA-256, that keeps the six most recently used entries and drops a load that fails. Make a retry drop its map's own entries and fetch them with `cache: 'reload'`. Test that two maps reading one file fetch and hash it once, that a failed load leaves no entry, that two pins for one address stay apart, and that a retry fetches again
- [x] 2.2 Add a swing source to `RaceMap` that reads two checked files, and draws only when both arrive and match their pins. Test that a file with another SHA-256 shows the failure and the retry with no colors and no list, and that a 404 on either file offers to reload the page, also when the other file fails its check
- [x] 2.3 Draw the swing map's frame with the finalist, the race, the area, both rounds, the seven signed steps, the hatched no-data swatch, the three sentences of the note, and the TSE and IBGE credits. Make a municipality's details show its name, both rounds' shares of the two finalists' votes and the swing, and make a click open its round-2 view. Test the frame's contents, the details, and the click's address
- [x] 2.4 Add the swing list to the folded list: headers that name the two finalists' votes as the denominator, each round's head-to-head share and the swing, grouped by state for President, sorted by name or by swing from the largest gain, with no-swing rows last and labeled. Test both sorts, the filter, a no-swing row and the headers

## 3. Finalist pages

- [x] 3.1 In `web/src/views/candidate-views.tsx` and `map-section.tsx`, render the swing section below the round-2 share map only under design decision 4. Test the rules as a unit: a synthetic round without the switch, a finalist under appeal in round 2, a pair of rounds with different municipalities, and an area with one municipality each give no swing section
- [x] 3.2 Add the swing messages to `web/messages/pt.json` and `en.json`: the frame's title, subtitle and note, the details, the list's headers and summary, the no-swing row and the `<noscript>` note. Test that the section renders its `<noscript>` note, with no list, in both languages, and that no message of the section, in either language, contains a word of transfer, migration or a named candidate's voters
- [x] 3.3 Set `ELEICOES_FIXTURE_SWING=1` on the main fixture build in `.github/workflows/ci.yml`, and add a browser test on Lula's page and on the other President finalist's page: the drawn map, the frame, a municipality's details, the click to round 2, the list and its headers, the mirrored steps, and the same values files as without the swing. Check that the round-1-only build shows no swing section

## 4. Measure and document

- [x] 4.1 Record in the PR the size of Lula's page and of the largest finalist's page on the fixture build with the swing switch, before and after the swing section, against the 2.5 MB gate. Make sure that the page size gate passes
- [x] 4.2 Update `web/README.md`: the swing map, the files it reads, the cache of checked files, the build's comparison of both rounds' municipalities, the guard, and the fixtures-only switch
