/** The example queries that a visitor can start from. */
import type { DataChoice } from './choice'

export interface Example {
  id: string
  choice: DataChoice
  sql: string
  pt: { title: string; description: string }
  en: { title: string; description: string }
}

export const EXAMPLES: readonly Example[] = [
  {
    id: 'comparecimento-por-estado',
    choice: { rounds: [1], races: [1], areas: ['br'] },
    pt: {
      title: 'Comparecimento por estado',
      description:
        'Eleitores aptos, eleitores que votaram e o percentual de comparecimento, para presidente.',
    },
    en: {
      title: 'Turnout by state',
      description: 'Eligible voters, voters who turned out and the turnout rate, for President.',
    },
    sql: `SELECT uf,
       sum(aptos)::BIGINT AS aptos,
       sum(comparecimento)::BIGINT AS comparecimento,
       round(100.0 * sum(comparecimento) / sum(aptos), 2) AS percentual_comparecimento
FROM comparecimento_municipio
GROUP BY uf
ORDER BY percentual_comparecimento DESC`,
  },
  {
    id: 'mais-votado-por-municipio',
    choice: { rounds: [1], races: [1], areas: ['br'] },
    pt: {
      title: 'O candidato a presidente mais votado, município a município',
      description:
        'Os votos e o percentual de votos válidos, em cada município, do candidato com mais votos no total.',
    },
    en: {
      title: 'The most voted President candidate, municipality by municipality',
      description:
        'The votes and the share of valid votes, in each municipality, of the candidate with the most votes overall.',
    },
    sql: `WITH lider AS (
  SELECT numero
  FROM votos_municipio
  WHERE tipo = 1
  GROUP BY numero
  ORDER BY sum(votos) DESC
  LIMIT 1
),
validos AS (
  SELECT uf, municipio, sum(votos) AS validos
  FROM votos_municipio
  WHERE tipo IN (1, 2)
  GROUP BY uf, municipio
)
SELECT v.uf, m.nome AS municipio, c.nome_urna AS candidato,
       sum(v.votos)::BIGINT AS votos,
       round(100.0 * sum(v.votos) / any_value(d.validos), 2) AS percentual_validos
FROM votos_municipio v
JOIN lider USING (numero)
JOIN validos d USING (uf, municipio)
JOIN municipios m ON m.municipio = v.municipio
JOIN candidatos c ON c.cargo = 1 AND c.uf = 'BR' AND c.numero = v.numero AND c.destino = 'Válido'
WHERE v.tipo = 1
GROUP BY v.uf, v.municipio, m.nome, c.nome_urna
ORDER BY percentual_validos DESC`,
  },
  {
    id: 'partidos-deputado-federal',
    choice: { rounds: [1], races: [6], areas: ['br'] },
    pt: {
      title: 'Votos de cada partido para deputado federal, por estado',
      description:
        'Os votos nos candidatos de cada partido somados aos votos só no partido (legenda).',
    },
    en: {
      title: "Each party's votes for federal deputy, by state",
      description:
        "The votes for each party's candidates plus the votes for the party alone (list).",
    },
    sql: `WITH partidos AS (
  SELECT DISTINCT uf, partido_numero, partido_sigla
  FROM candidatos
  WHERE cargo = 6
),
votos_partido AS (
  SELECT v.uf,
         CASE WHEN v.tipo = 2 THEN v.numero ELSE c.partido_numero END AS partido_numero,
         v.votos
  FROM votos_municipio v
  LEFT JOIN candidatos c
    ON v.tipo = 1 AND c.cargo = v.cargo AND c.uf = v.uf AND c.numero = v.numero
   AND c.destino = 'Válido'
  WHERE v.cargo = 6 AND v.tipo IN (1, 2)
)
SELECT v.uf, p.partido_sigla AS partido, sum(v.votos)::BIGINT AS votos
FROM votos_partido v
JOIN partidos p USING (uf, partido_numero)
GROUP BY v.uf, p.partido_sigla
ORDER BY v.uf, votos DESC`,
  },
  {
    id: 'brancos-nulos-governador',
    choice: { rounds: [1], races: [3], areas: ['br'] },
    pt: {
      title: 'Votos brancos e nulos para governador, por município',
      description:
        'Os votos em branco e os nulos, e seu percentual entre todos os votos do município.',
    },
    en: {
      title: 'Blank and null votes for Governor, by municipality',
      description: "Blank votes and null votes, and their share of all the municipality's votes.",
    },
    sql: `SELECT v.uf, m.nome AS municipio,
       sum(v.votos)::BIGINT AS votos,
       coalesce(sum(v.votos) FILTER (WHERE v.tipo = 3), 0)::BIGINT AS brancos,
       coalesce(sum(v.votos) FILTER (WHERE v.tipo = 4), 0)::BIGINT AS nulos,
       round(100.0 * coalesce(sum(v.votos) FILTER (WHERE v.tipo IN (3, 4)), 0) / sum(v.votos), 2)
         AS percentual_brancos_nulos
FROM votos_municipio v
JOIN municipios m ON m.municipio = v.municipio
GROUP BY v.uf, v.municipio, m.nome
ORDER BY percentual_brancos_nulos DESC`,
  },
  {
    id: 'maior-abstencao',
    choice: { rounds: [1], races: [1], areas: ['br'] },
    pt: {
      title: 'Os 20 municípios com maior abstenção',
      description: 'O percentual de eleitores aptos que não votaram para presidente.',
    },
    en: {
      title: 'The 20 municipalities with the highest abstention',
      description: 'The share of eligible voters who did not vote for President.',
    },
    sql: `SELECT t.uf, m.nome AS municipio,
       sum(t.aptos)::BIGINT AS aptos,
       sum(t.abstencoes)::BIGINT AS abstencoes,
       round(100.0 * sum(t.abstencoes) / sum(t.aptos), 2) AS percentual_abstencao
FROM comparecimento_municipio t
JOIN municipios m ON m.municipio = t.municipio
GROUP BY t.uf, t.municipio, m.nome
ORDER BY percentual_abstencao DESC
LIMIT 20`,
  },
  {
    id: 'locais-de-votacao',
    choice: { rounds: [1], races: [1], areas: ['pe'] },
    pt: {
      title: 'Os locais de votação de Recife',
      description: 'Cada local de votação da capital de Pernambuco, com suas seções e eleitores.',
    },
    en: {
      title: "Recife's polling places",
      description: "Each polling place in Pernambuco's capital, with its stations and voters.",
    },
    sql: `SELECT s.zona, s.nome_local, s.endereco, s.bairro,
       count(*) AS secoes,
       sum(s.eleitores)::BIGINT AS eleitores
FROM secoes s
JOIN municipios m ON m.municipio = s.municipio
WHERE m.uf = 'PE' AND m.capital
GROUP BY s.zona, s.local_votacao, s.nome_local, s.endereco, s.bairro
ORDER BY eleitores DESC`,
  },
]
