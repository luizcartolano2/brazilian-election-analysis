# Research: 2026-10-06 exploration

These files come from the session that decided whether this project was possible. They
are prototypes. The pipeline does not import them, and nothing here is tested or
maintained. The first OpenSpec change ports what is worth keeping into `pipeline/`.

| File | What it is |
|---|---|
| [`tse-2026-data-sources.md`](tse-2026-data-sources.md) | Where TSE publishes the 2026 results, at every level of detail, with URL patterns and formats |
| [`der.py`](der.py) | A minimal ASN.1 DER walker, enough to read a voting machine's tally (BU) and ballot record (RDV) without a schema |
| [`crosstab.py`](crosstab.py) | The first estimator of how many voters chose each pair of candidates across two races |

## What the exploration established

- Every layer of the results is public and needs no login: aggregates per country, state
  and municipality, the voting-machine files for each of the 499,248 polling stations, and
  bulk CSVs per polling station.
- For one polling station in Acre, the machine's tally, a recount of its ballot record and
  the bulk CSV gave identical numbers.
- The ballot record (RDV) sorts each race's ballots independently. All 285 race lists in
  57 random stations were sorted. No public file links one voter's choices across races,
  so any "voted for Y and Z" figure is an estimate. This is why the project shows ranges.
- On synthetic data, a single state-wide fit can miss by 13 to 15 points when voter
  behavior varies by region. Fitting per municipality cut the worst error to 2 to 10
  points. The tables are in `tse-2026-data-sources.md`.

## Known problems

`crosstab.py` was written to answer a question quickly, not to last. A port must address
these points:

- The optimizer reports success without moving when the objective is in raw vote counts.
  The fix in the file rescales to vote shares, but the general lesson stands: always
  fail loudly when a fit does not converge.
- The shrinkage weight toward the state fit (30 sections) is a guess with no tuning.
- Raking runs a fixed 200 iterations with no convergence check.
