## 1. Tie each scenario to its test

- [ ] 1.1 results-dataset: name in the PR the pipeline test for each new scenario: a candidate that the aggregate omits, a party's candidate votes, a vote with no named line, an election that vanishes from TSE's files, an omitted candidate with no party, and a President candidate that Brazil's aggregate omits. Add a test only where a scenario has none
- [ ] 1.2 data-publishing: name in the PR the test that reads a version's reconciled races from its manifest, and add one only if none exists
- [ ] 1.3 results-explorer: name in the PR the tests for a pin that drops a race, a pin that adds one, a round's first pin, and Rio's cancelled runoff, and the CI step that checks the pins. Add a test only where a scenario has none
- [ ] 1.4 results-maps: name in the PR the browser tests that show the swing map reads only the share maps' files, and that its Brazil frame states that it leaves out the votes cast abroad
