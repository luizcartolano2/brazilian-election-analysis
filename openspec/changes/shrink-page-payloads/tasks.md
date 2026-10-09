## 1. Navigation files

- [ ] 1.1 Check whether Next 16 has an option that stops a static export from writing `__next._full.txt`, `__next._tree.txt` and the `__PAGE__` segment files. Record the answer in the PR, and use the option if it exists
- [ ] 1.2 Otherwise add `scripts/prune-payloads.ts`, run it in `npm run build` after `next build` and before the page size gate, and keep each page's `index.txt`. Test it on a folder that holds every kind of file, and test that it refuses a folder with no `index.html`
- [ ] 1.3 Add a browser test that follows a link on the Brazil, a state, a race, a candidate and a drill-down page, and fails on any payload request that gets a 404

## 2. Values files

- [ ] 2.1 In `prepare-data.ts`, copy the Brazil map's values and each race's votes by municipality, per area and round, to `public/mapas/t<round>/<area>/<name>.<sha16>.json`, with names in title case, and record each file's address and SHA-256. Test that a fixtures build writes one file per race, area and round, named by its content
- [ ] 2.2 Cache `/mapas/` for good in `vercel.json`, as `/busca/` is. Extend the test of `vercel.json`

## 3. Maps that load their values

- [ ] 3.1 Give `RaceMap` a source that is either the values or a checked file, with the frame drawn before the file arrives. Test that the map draws only when both files check out, that a values file with another SHA-256 shows the failure and the retry, and that the retry loads it again
- [ ] 3.2 Load the Brazil page's President map from its file. Test that the Brazil page's HTML holds the file's address and no municipality's values, and that the map still draws and links each municipality
- [ ] 3.3 Load each candidate page's share map and list from its race's file, building the candidate's map with `shareMap()`. Test a President candidate's list grouped by state, sorting and filtering, a round-2 finalist's two maps, and a candidate with no votes in the file
- [ ] 3.4 Add the `<noscript>` note and the messages for a values file that fails, in Portuguese and English. Test a candidate page with JavaScript disabled: its results, six largest municipalities and state shares, and the note, with no list

## 4. Measure and document

- [ ] 4.1 Record in the PR the export's size and file count, the largest page, the Brazil page and Lula's page, before and after. Make sure that the page size gate passes
- [ ] 4.2 Update `web/README.md`: the values files, their checks, and the pruned navigation files
