# Brazilian Election Analysis

> Análise dos resultados das eleições brasileiras a partir dos dados oficiais do TSE,
> começando por 2026.

Analysis of Brazil's election results from official TSE data, starting with the 2026
general election. The app will live at `eleicoes.luizcartolano.com`, in Portuguese first
and English second.

## What it can and cannot tell you

TSE publishes results down to each polling station, and the files of every voting
machine. That supports exact answers to questions such as "how did this municipality
vote for governor?".

It does not support exact answers to "how many people voted for President Y *and*
Governor Z?". Each voting machine stores its ballots sorted race by race, which protects
the secrecy of the vote, so no public file links one voter's choices across races. The
project estimates those combinations from polling-station totals, a technique called
ecological inference. Every estimate is shown with a range that is guaranteed to contain
the true value, and is never presented as a count of people.

The project never scores polling stations or machines as suspicious, and never projects
a runoff. [`docs/decisions.md`](docs/decisions.md) lists what is in and out of scope, and
why.

## Status

The pipeline builds and checks the whole first round: every polling station in Brazil
and abroad matches TSE's own totals. The Worker that serves the data to browsers is
written. Publishing and the app come next.

| Milestone | Target |
|---|---|
| Official first-round results, explorable to the polling station | Before the runoff on 2026-10-25 |
| Cross-race estimates and first-to-second-round transfers | After the runoff |

## How it will work

```
TSE open data ──> pipeline (GitHub Actions) ──> Parquet on Cloudflare R2
                                                        │
                       visitor's browser <── Worker <───┘
                  (DuckDB-WASM queries the files)
```

1. The pipeline downloads TSE's files, checks that they reconcile, builds Parquet and
   computes the estimates.
2. Only GitHub Actions publishes. Each run writes a new, immutable data version with a
   manifest of its sources and checksums.
3. The app is a static site. It pins one data version, and the visitor's browser queries
   it through a small Cloudflare Worker.

## Repository layout

| Path | Contents |
|---|---|
| `pipeline/` | Python: download, checks against TSE, Parquet. See [`pipeline/README.md`](pipeline/README.md) |
| `web/` | The Next.js app. Only its sample data (`web/fixtures/`) exists so far |
| `worker/` | The Cloudflare Worker in front of R2. See [`worker/README.md`](worker/README.md) |
| `docs/` | Decisions and, later, the methodology |
| `research/` | The prototypes from the exploration on 2026-10-06. Not part of the pipeline |
| `openspec/` | Specs and in-flight changes |

## Data and credit

Source data: Tribunal Superior Eleitoral (TSE), [Portal de Dados Abertos][portal],
published under CC BY. The code is under the [MIT license](LICENSE). The data this
project derives is under CC BY 4.0. [`DATA_LICENSE.md`](DATA_LICENSE.md) has the details
and the credit line to use.

[portal]: https://dadosabertos.tse.jus.br/

## Working on it

Feature work goes through [OpenSpec](https://github.com/Fission-AI/OpenSpec):
`/opsx:propose`, then `/opsx:apply`, then `/opsx:archive`. Tasks and bugs are GitHub
issues, and every change reaches `main` through a pull request.
[`CLAUDE.md`](CLAUDE.md) lists the rules the code depends on.

If you think a number on the site is wrong, open an issue with the "Dispute a number"
template.
