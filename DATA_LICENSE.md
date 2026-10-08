# Data license and credit

The code in this repository is under the [MIT license](LICENSE). Data is covered here.

## Source data

| Source | Terms |
|---|---|
| TSE [Portal de Dados Abertos](https://dadosabertos.tse.jus.br/) (bulk CSV files, candidates, electorate) | CC BY. Each package on the portal declares `license_id: cc-by`, checked on 2026-10-06 for `candidatos-2026`, `eleitorado-2026`, `resultados-2026-correspondencias-esperadas-e-efetivadas-1-turno` and `resultados-2024-boletim-de-urna` |
| TSE results site, `resultados.tse.jus.br` (aggregates and voting-machine files) | No license is stated there. The project treats these files as public records and credits TSE in the same way. Not verified further |
| IBGE Malha Municipal Digital 2025 (`BR_Municipios_2025.zip` on `geoftp.ibge.gov.br`, the municipal boundaries for the maps) | IBGE's own terms, which its [methodological note 01/2026](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102268.pdf), page 7, calls compatible with CC BY 4.0. They allow a modified copy to be redistributed with credit to IBGE. A user who generalizes the boundaries must tell end users that the geometry changed. The note also says that the boundaries are not an official demarcation. Read on 2026-10-08 |

The portal links its CC BY entry to the Open Definition page and does not name a version.

## Data this project derives

The Parquet files, JSON files and estimates that this project publishes are under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit both TSE, as the
source, and this project, as the processor.

The boundary files under `assets/geo/` are outside that grant. They are IBGE's data,
simplified and reprojected by this project, and IBGE's terms above apply to them. Each
boundary build's `manifest.json` carries the credit line below.

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

## Credit line for the boundaries

Every map shows this line inside its frame, next to the TSE credit.

Portuguese:

> Limites municipais: IBGE, Malha Municipal Digital 2025, sob licença compatível com CC BY
> 4.0. Geometria simplificada e reprojetada por este projeto. Limites aproximados, não
> oficiais.

English:

> Municipal boundaries: IBGE, Malha Municipal Digital 2025, under a license compatible
> with CC BY 4.0. Geometry simplified and reprojected by this project. Approximate
> boundaries, not official ones.

## Adding a source

Before the pipeline or the app reads a new source, add it to the table above with its
terms and the date they were checked.
