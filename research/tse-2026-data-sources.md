# TSE 2026 election data: where the raw results live

Explored on 2026-10-06, two days after the first round of 4 October 2026.
Every source below is public, needs no authentication, and returned HTTP 200.

## Identifiers

| Key | Value |
|---|---|
| Cycle (`ciclo`) | `ele2026` |
| Pleito (`cd_pleito`) | `3220` |
| President, 1st round | election `6257` (2nd round `6258`), cargo `1` |
| Governor, Senate, Congress, 1st round | election `6259` (2nd round `6260`), cargos `3,5,6,7,8` |
| Conselheiro Distrital | election `6261`, cargo `25` |

The master configuration is `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`.
It lists every election and the URL template for each file type.

## Layer 1: aggregate results (results app backend)

Base: `https://resultados.tse.jus.br/oficial/ele2026/<election>/`

| File | Path |
|---|---|
| Results for Brazil | `dados/br/br-c0001-e006257-u.json` |
| Results for a state | `dados/sp/sp-c0001-e006257-u.json` |
| Results for a municipality | `dados/ac/ac01066-c0001-e006257-u.json` (TSE municipality code, 5 digits) |
| Municipality list | `config/mun-e006257-cm.json` |
| Candidate photos | `fotos/br/<sqcand>.jpeg` |

Each file exists as `.json` and as `.jws`. The `.jws` is a JSON Web Signature with `alg: EdDSA` and `kid: sNbt9Q_fLS65zE1_ZLNV-XRRwPY`.
The app reads the `.jws`. I did not locate the public key, so the signatures are not yet verified.

Field codes in the payload: `s` sections, `e` electorate and turnout, `v` vote totals, `carg[].agr[].par[].cand[]` candidates with `vap` (votes) and `st` (status).
National check on 2026-10-05 12:51: the candidate `vap` values sum to `vv` (valid votes), 119,300,788.

## Layer 2: raw files from each voting machine (arquivo-urna)

Base: `https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3220/`

1. Section list for a state: `config/<uf>/<uf>-p003220-cs.json`.
   The list gives municipality, zone and section numbers, with a timestamp per section.
   Acre has 22 municipalities and 2,411 sections.
2. Section index: `dados/<uf>/<mun>/<zona>/<secao>/p003220-<uf>-m<mun>-z<zona>-s<secao>-aux.json`.
   The index lists a `hash` and the file names.
3. Each file: `dados/<uf>/<mun>/<zona>/<secao>/<hash>/<file name>`.

| File suffix | Content | Format |
|---|---|---|
| `-bu.dat` | Boletim de urna: the signed tally of the machine | ASN.1 DER |
| `-rdv.dat` | Registro digital do voto: every ballot, in shuffled order | ASN.1 DER |
| `-log.jez` | Machine event log, from setup to closing | ZIP with `logd.dat` (Latin-1 TSV) |
| `-vota.vsc` | Signatures and hashes of the files | binary |

Sample section AC / 01066 / 0004 / 0077 (Porto Walter): BU 9 KB, RDV 15 KB, log 102 KB, vsc 63 KB.
At about 190 KB per section, the 499,248 sections hold roughly 95 GB. BU and RDV alone are roughly 12 GB.

What the BU holds, from the generic DER dump in `der.py`:

- Machine serial, software version, load media, open and close timestamps
- Electors registered (289) and voters who attended (234)
- Voters identified by biometrics against voters enabled by a release code (`C1` triple: 9, 212, 13)
- Votes per candidate number, blank and null, per race

What the RDV holds: one record per ballot per race, with the digits typed.
A null vote keeps the typed number. In the sample section, 14 voters typed `22` and 9 typed `13` for Governor, which are presidential numbers.

What the log holds: about 5,700 lines per machine, each with a timestamp, level, machine id, module, message and hash chain value.
It records voter identification, biometric results, the "Eleitor foi habilitado" and vote-computed events, and contingency events.

## Layer 3: bulk open data (dadosabertos.tse.jus.br, CDN)

Base: `https://cdn.tse.jus.br/estatistica/sead/odsele/`

| Dataset | File | Size | Published |
|---|---|---|---|
| Votes per section, President | `votacao_secao/votacao_secao_2026_BR.zip` | 143 MB | 2026-10-06 |
| Votes per section, state races | `votacao_secao/votacao_secao_2026_<UF>.zip` | 7 MB (AC) | 2026-10-06 |
| Turnout, blank and null per section | `detalhe_votacao_secao/detalhe_votacao_secao_2026.zip` | 171 MB | 2026-10-05 |
| Votes per candidate per municipality and zone | `votacao_candidato_munzona/votacao_candidato_munzona_2026.zip` | 316 MB | 2026-10-05 |
| Candidates | `consulta_cand/consulta_cand_2026.zip` | 3 MB | 2026-10-05 |
| Voter profile per section (age, sex, education) | `perfil_eleitor_secao/perfil_eleitor_secao_2026_<UF>.zip` | 9 MB (AC) | 2026-07-17 |
| Polling places with address | `eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip` | 176 MB | 2026-10-06 |

CSV format: `;` separator, Latin-1 encoding, text quoted, numbers unquoted.
The per-state `votacao_secao` file holds only election `6259`. The President is in the `_BR` file.

Other 2026 packages on the CKAN API (`https://dadosabertos.tse.jus.br/api/3/action/package_search?q=2026`):

- `resultados-2026-correspondencias-esperadas-e-efetivadas-1-turno`: expected against actual machine for each section, `eleicoes2026/correspesp/CESP_1t_<UF>_*.zip`
- `resultados-2026-logs-do-sistema-de-preparacao-das-urnas-eletronicas-gedai-1-turno`: machine preparation logs, `eleicoes2026/logsgedai/log_gedai_1t_<UF>_*.zip`
- `candidatos-2026`, `eleitorado-2026`, `prestacao-de-contas-eleitorais-2026` (campaign finance), `mesarias-mesarios-e-funcoes-especiais-2026`

Not published yet: a `resultados-2026-boletim-de-urna` package with per-state ZIPs of the machine files.
The 2022 package appeared on 2022-11-05 and the 2024 package on 2024-10-30, so the 2026 one probably comes after the second round on 25 October. That date is an inference, not a TSE statement.

## Consistency check on one section

AC / 01066 / 0004 / 0077, Governor: BU, RDV recount and `votacao_secao` CSV all give 97, 87, 9, 7, 2 blank and 32 null, total 234.
President: BU and RDV recount both give 103 (22), 99 (13), 6, 5, 4, 4 blank and 13 null, total 234.

## Cross-race linkage: not possible

The RDV sorts the ballots of each race by vote type and number, independently of the other races.
All 285 race lists in 57 random Acre sections were sorted.
So no public file links one voter's President choice to the same voter's Governor choice.
A question such as "how many voted President Y and Governor Z" needs ecological inference on per-section totals.

`crosstab.py` gives two numbers for each pair:

- Exact bounds per section (Fréchet), summed. They always contain the truth, but they are wide.
- A point estimate: constrained regression per municipality, shrunk toward the state fit, then raked to each section's margins.

Synthetic test on an Acre-sized state (2,270 sections):

| True behavior | State-wide fit, worst cell error | Per-municipality fit, worst cell error |
|---|---|---|
| Same everywhere | 1.4 pts | not run |
| Shifts between municipalities | 13.3 pts | 2.4 pts |
| Shifts inside municipalities too | 15.1 pts | 9.8 pts |
