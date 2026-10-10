## 1. Navigation files

- [x] 1.1 Check whether Next 16 has an option that stops a static export from writing `__next._full.txt`, `__next._tree.txt` and the `__PAGE__` segment files. Record the answer in the PR, and use the option if it exists
- [x] 1.2 Otherwise add `scripts/prune-payloads.ts`, run it in `npm run build` after `next build` and before the page size gate, and keep each page's `index.txt`. Test it on a folder that holds every kind of file, and test that it refuses a folder with no `_next` folder
- [x] 1.3 Add a browser test that follows a link on the Brazil, a state, a race, a candidate and a drill-down page, and fails on any payload request that gets a 404

## 2. Values files

- [x] 2.1 In `prepare-data.ts`, write each round's Brazil map values and each race's votes by municipality, per area and round, to `public/mapas/t<round>/<area>/<name>.<sha16>.json`, with names in title case, naming each file and pinning it by the SHA-256 of its final bytes. Test that a fixtures build writes one file per race, area and round, and that each file's name and pin match its bytes
- [x] 2.2 Cache `/mapas/` for good in `vercel.json`, as `/busca/` is. Extend the test of `vercel.json`
- [x] 2.3 Make `scripts/page-size.ts` add the values files that a page's HTML names to the page's size, and name each file when a page fails. Test a page that passes alone and fails with its files

## 3. Maps that load their values

- [x] 3.1 Give `RaceMap` a source that is either the values or a checked file, with the frame drawn before the file arrives, the values requested when the page loads, and the boundary requested near the viewport. Test that the map draws only when both files check out, that a values file with another SHA-256 shows the failure and the retry, that the retry requests the file with `cache: 'reload'`, and that a 404 offers to reload the page
- [x] 3.2 Load the President map of each round's Brazil page from its file. Test on the fixture build with both rounds that `/2026/` and `/2026/segundo-turno/` hold the file's address and no municipality's values, and that each map still draws and links each municipality
- [x] 3.3 Load each candidate page's share map and list from its race's file, building the candidate's map with `shareMap()`, with the list folded under a summary that names its count. Test a President candidate's list grouped by state, sorting and filtering, a list that is complete before the boundary file arrives, a round-2 finalist's two maps, and a candidacy under appeal, which requests no values file
- [x] 3.4 Add the `<noscript>` note and the messages for the list's summary, a values file that fails, and the reload, in Portuguese and English. Test a candidate page with JavaScript disabled: its results, six largest municipalities and state shares, and the note, with no list

## 4. Measure and document

- [x] 4.1 Record in the PR the export's size and file count, the largest page, both Brazil pages, Lula's page and the largest values file, before and after. Make sure that the page size gate passes
- [x] 4.2 Update `web/README.md`: the values files, their checks, the pruned navigation files, and that state and race pages list their municipalities in the HTML while candidate pages load their lists with their maps
