## 1. Swing data

- [ ] 1.1 In `web/src/lib/maps.ts`, build a finalist's swing rows from two rounds' `CandidateVotes`, joined on the TSE municipality code: each round's head-to-head share and the swing in points, or no swing where the two finalists had no votes in a round. Test the swing on in-memory files, the mirror between the two finalists, the no-data case, and a municipality that one file lacks, which throws
- [ ] 1.2 Add the seven swing steps and ColorBrewer's seven-class PRGn to `web/src/lib/map-colors.ts`, with the no-data fill. Test each step's bounds, including both edges of the middle step, and that no swing color equals a candidate shade
- [ ] 1.3 In `web/scripts/prepare-data.ts`, fail the build when a race's round-1 and round-2 values files for one area list different municipalities. Test a pair that matches and a pair that differs by one municipality

## 2. Swing map

- [ ] 2.1 Give `RaceMap` a module-level cache of checked, parsed values files, one promise per address, that a retry clears before it fetches with `cache: 'reload'`. Test that two maps reading one address fetch and hash it once, and that a retry fetches it again
- [ ] 2.2 Add a swing source to `RaceMap` that reads two checked files, and draws only when both arrive and match their pins. Test that a file with another SHA-256 shows the failure and the retry with no colors and no list, and that a 404 on either file offers to reload the page
- [ ] 2.3 Draw the swing map's frame with the finalist, the area, both rounds, the seven signed steps, the no-data swatch, the note on the two official counts, and the TSE and IBGE credits. Test that the frame holds each of them, and that neither the frame nor the list contains a word of transfer, migration or a named candidate's voters, in either language
- [ ] 2.4 Add the swing list to the folded list: each round's head-to-head share and the swing, grouped by state for President, sorted by name or by swing from the largest gain, with no-swing rows last and labeled. Test both sorts, the filter and a no-swing row

## 3. Finalist pages

- [ ] 3.1 In `web/src/views/candidate-views.tsx` and `map-section.tsx`, render the swing section below the round-2 share map only under design decision 3. Test, on the fixture build, that the synthetic round 2 shows no swing map on Lula's page, on a Governor finalist's page, or on a Federal District finalist's page
- [ ] 3.2 Add the swing messages to `web/messages/pt.json` and `en.json`, the frame's note, the list's columns and summary, the no-swing row and the `<noscript>` note. Test that the section renders its `<noscript>` note, with no list, in both languages
- [ ] 3.3 Add a browser test of the drawn swing map, its frame, the mirror between the two President finalists and the list, which runs when the fixture build's round 2 is not synthetic and otherwise skips with the recut of issue 36 as its reason

## 4. Document

- [ ] 4.1 Update `web/README.md`: the swing map, the files it reads, the cache of checked files, the build check on both rounds' municipalities, and the guard on synthetic data
