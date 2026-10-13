## Why

Three PRs changed what the pipeline writes and when a build fails, as bug fixes with no
OpenSpec change. Their reviews listed what the living specs now leave out:

- #47 fixed the summaries for #11 and #12. A summary now names every candidate with votes,
  a party's candidate votes count valid votes only, and a new check fails the build when a
  vote has no named line. The app now fails its build on a vote under appeal with no line,
  and sums party totals from the valid candidates.
- #52 added the guards of #48. The pipeline fails when a municipal election in the round's
  configuration has no vote rows, and a published build fails when a pinned version's
  races differ from a committed list.
- The review of #51, which archived `add-swing-map`, found two lines of the swing
  requirements that no longer match the code.

The runoff's publish and pin follow the freeze, and both rely on these checks. A spec that
omits a check lets a later change drop it without contradicting anything.

## What Changes

- `results-dataset`: a summary names every candidate with votes, including one that TSE's
  aggregate omits but its per-zone file classifies. Such a candidate takes its name and
  destination from that file, its party from the candidate file, and no outcome. A party's
  `votos_candidatos` counts its valid candidates' votes only, from schema version 2.
- `results-dataset`: Brazil's summary keeps a known limit. It names only the candidates in
  Brazil's aggregate, and a President candidate that it omits fails the summary check.
  Naming that candidate would need a merge of the states' lines, which no TSE file has
  needed, and the check keeps the limit from passing unnamed.
- `results-dataset`: the reconciliation lists the summary check. The run also fails at once
  when a municipal election in the round's configuration has no vote rows, and when the
  lookup of an omitted candidate fails. Such a failure reports only itself and drops the
  mismatches found before it, as a run with unclassified vote rows already does. The rule
  to report every mismatch keeps to the listed checks.
- `data-publishing`: the manifest records the schema version and the checks that the build
  ran, under `verificacoes`, among them each race that it reconciled with TSE's aggregate.
- `results-explorer`: every vote under appeal sits on a named line, or the build fails, and
  a party's candidate votes are the sum of its valid candidates' votes, whatever the
  pinned version's schema.
- `results-explorer`: a published build fails when a pinned version's reconciled races
  differ from its round's list in `web/src/pinned-races.json`, when a pinned round has no
  list, or when a manifest records no reconciled races. The list verifies the races that
  the pipeline took from TSE's vote rows, and never decides them, so it keeps the rule of
  "Round two builds like round one". CI runs the same checks on every PR. The scenario of
  Rio's cancelled runoff names the edit of the list.
- `results-maps`: the swing map reads the files of the page's share maps, one per round. On
  Brazil's map, its frame also states that it leaves out the votes cast abroad.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `results-dataset`: the summaries' candidates and party totals, and the checks and
  failures of the reconciliation.
- `data-publishing`: the manifest's record of the checks it ran.
- `results-explorer`: the votes under appeal and the party totals that a page shows, a
  pinned version's races, and the checks that CI runs on the pins.
- `results-maps`: the swing map's files and the note on the votes cast abroad.

## Invariants

This change touches these invariants in `CLAUDE.md`, and it keeps each one as follows:

- Official numbers reconcile, or nothing publishes. The new text records more checks, and
  none of them drops or adjusts a row.
- Only GitHub Actions publishes data. The checks of a pin only read published versions.
- At run time the app reads only pinned data. The race list gates the build, not the
  browser.
- An estimate is never a count. The change shows no estimate.
- Every user-facing string exists in Portuguese and English. The change adds no string.
  The note on the votes abroad already ships in both.

The change records decisions that D13 and D14 already hold: D13 keeps the race list as pin
data, and D14 keeps the timing of the swing map.

## Non-goals

- No change to code, data, the pipeline, the Worker or the app's pages.
- No new check. The change records the checks that the three PRs merged.
- No change to the tension between "votes that changed between the finalists" and the rule
  against saying where a vote went. The review of #51 found that the two read together.

## Impact

- `openspec/specs/results-dataset/spec.md`, `data-publishing/spec.md`,
  `results-explorer/spec.md` and `results-maps/spec.md`, at archive time.
- No code. Each new scenario names a test that the three PRs added.
