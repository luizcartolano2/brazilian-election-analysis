# Data license and credit

The code in this repository is under the [MIT license](LICENSE). Data is covered here.

## Source data

| Source | Terms |
|---|---|
| TSE [Portal de Dados Abertos](https://dadosabertos.tse.jus.br/) (bulk CSV files, candidates, electorate) | CC BY. Each package on the portal declares `license_id: cc-by`, checked on 2026-10-06 for `candidatos-2026`, `eleitorado-2026`, `resultados-2026-correspondencias-esperadas-e-efetivadas-1-turno` and `resultados-2024-boletim-de-urna` |
| TSE results site, `resultados.tse.jus.br` (aggregates and voting-machine files) | No license is stated there. The project treats these files as public records and credits TSE in the same way. Not verified further |

The portal links its CC BY entry to the Open Definition page and does not name a version.

## Data this project derives

The Parquet files, JSON files and estimates that this project publishes are under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit both TSE, as the
source, and this project, as the processor.

Every estimate comes with a range. We ask anyone who reuses an estimate to keep its range
next to it. The license does not require this, but a figure without its range misstates
what the data can show.

## Credit line

Portuguese:

> Fonte: Tribunal Superior Eleitoral (TSE), Portal de Dados Abertos. Processamento:
> Brazilian Election Analysis (github.com/luizcartolano2/brazilian-election-analysis).

English:

> Source: Brazil's Superior Electoral Court (TSE), Open Data Portal. Processing:
> Brazilian Election Analysis (github.com/luizcartolano2/brazilian-election-analysis).

## Adding a source

Before the pipeline reads a new source, such as IBGE's municipal boundaries for the maps,
add it to the table above with its terms and the date they were checked.
