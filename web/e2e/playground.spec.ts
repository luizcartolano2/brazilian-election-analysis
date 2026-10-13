import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { formatBytes } from '../src/lib/playground/display'
import { EXAMPLES } from '../src/lib/playground/examples'
import { linkFragment, type LinkState } from '../src/lib/playground/link'
import type { Manifest } from '../src/lib/manifest'
import { summary } from './fixtures'

declare global {
  interface Window {
    __violations: string[]
  }
}

const PAGE = '/2026/consultas/'
const ENGINE_FILES = /\.parquet|duckdb-eh\.wasm|duckdb_extension|duckdb-browser-eh\.worker/

function linkTo(state: Partial<LinkState> & { choice: LinkState['choice'] }): string {
  const versions: LinkState['versions'] = {}
  for (const round of state.choice.rounds) versions[round] = 'teste'
  return `${PAGE}${linkFragment({ versions, sql: 'SELECT 1', ...state })}`
}

async function open(page: Page, address = PAGE) {
  await page.goto(address)
  await expect(page.getByTestId('playground')).toBeVisible()
}

function form(page: Page) {
  return page.getByTestId('playground-form')
}

function editor(page: Page) {
  return page.getByLabel('SQL · você pode editar')
}

async function runSql(page: Page, sql: string) {
  await editor(page).fill(sql)
  await page.getByRole('button', { name: '▶ Executar' }).click()
}

function result(page: Page) {
  return page.getByTestId('playground-result')
}

function status(page: Page) {
  return page.getByTestId('playground-status')
}

/** The result's rows, each as its cells' text. */
async function resultRows(page: Page): Promise<string[][]> {
  return result(page)
    .locator('tbody tr')
    .evaluateAll((rows) =>
      rows.map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')),
    )
}

function requests(page: Page): string[] {
  const seen: string[] = []
  page.on('request', (request) => seen.push(request.url()))
  return seen
}

function fixtureManifest(): Manifest {
  return JSON.parse(
    readFileSync(path.join(import.meta.dirname, '..', 'fixtures', 'manifest.json'), 'utf-8'),
  ) as Manifest
}

test.describe.configure({ timeout: 90_000 })

test('opening the playground shows its parts and requests no data file and no engine file', async ({
  page,
}) => {
  const seen = requests(page)
  await open(page)
  await expect(page.getByTestId('playground-data')).toBeVisible()
  await expect(page.getByTestId('playground-form')).toBeVisible()
  await expect(editor(page)).toBeVisible()
  await expect(page.getByTestId('playground-tables')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Exemplos' })).toBeVisible()
  await page.waitForTimeout(1000)
  expect(seen.filter((url) => ENGINE_FILES.test(url))).toEqual([])
})

test('without JavaScript the page says that the playground needs it', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto(PAGE)
  // Playwright turns scripts off without telling the HTML parser, so the test reads the text.
  const note = await page.locator('main noscript').innerHTML()
  expect(note).toContain('As consultas precisam de JavaScript.')
  expect(note).toContain('href="/2026/fontes/"')
  await context.close()
})

test('the sources page links to the playground', async ({ page }) => {
  await page.goto('/2026/fontes/')
  await expect(
    page.getByRole('main').getByRole('link', { name: 'consultas', exact: true }),
  ).toHaveAttribute('href', PAGE)
})

test('a query runs under the production headers, with its caption, and no policy violation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__violations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__violations.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const response = await page.goto(PAGE)
  expect(response?.headers()['content-security-policy']).toContain("connect-src 'self'")
  await page.getByRole('button', { name: '▶ Executar' }).click()
  const caption = page.getByTestId('playground-caption')
  await expect(caption).toContainText(
    'Resultado de uma consulta de visitante sobre dados oficiais do TSE.',
    { timeout: 40_000 },
  )
  await expect(caption).toContainText('1º turno: versão teste')
  await expect(caption).toContainText('Fonte: Tribunal Superior Eleitoral (TSE)')
  expect(await caption.evaluate((element) => element.parentElement?.tagName)).toBe('TABLE')
  expect(await page.evaluate(() => window.__violations)).toEqual([])
  expect(errors).toEqual([])
})

for (const [label, sql, url] of [
  [
    "another data version's file",
    "SELECT * FROM read_parquet('https://eleicoes-data.luizcartolano.workers.dev/v/20260101-0000000-1/2026/t1/votos/cargo=1/uf=AC.parquet')",
    'workers.dev',
  ],
  ["another site's CSV", "SELECT * FROM read_csv('https://example.com/x.csv')", 'example.com'],
  ['a database file', "ATTACH 'https://example.com/x.duckdb' AS other", 'example.com'],
  ['a copy to a file', "COPY (SELECT 1 AS x) TO '/consultas/x.csv'", null],
  ['a turn of file access back on', 'SET enable_external_access = true', null],
  ['an extension', 'LOAD json', null],
] as const) {
  test(`the engine refuses ${label}, and the browser requests nothing for it`, async ({ page }) => {
    const seen = requests(page)
    await open(page)
    await runSql(page, sql)
    await expect(status(page).locator('pre')).not.toBeEmpty({ timeout: 40_000 })
    await expect(result(page)).toHaveCount(0)
    if (url !== null) expect(seen.filter((entry) => entry.includes(url))).toEqual([])
  })
}

test('a table that one run creates is gone in the next', async ({ page }) => {
  await open(page)
  await runSql(page, 'CREATE TABLE guardada AS SELECT 1 AS x; SELECT * FROM guardada')
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  await runSql(page, 'SELECT * FROM guardada')
  await expect(status(page)).toContainText('guardada', { timeout: 20_000 })
  await expect(result(page)).toHaveCount(0)
})

const STATION_SUM = 'SELECT sum(votos) AS votos FROM votos_secao'

/** The default form query's rows and the station votes' sum, on a clean run. */
async function cleanNumbers(page: Page) {
  const formSql = await editor(page).inputValue()
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  const form = await resultRows(page)
  await runSql(page, STATION_SUM)
  await expect(result(page)).toContainText('votos', { timeout: 20_000 })
  return { formSql, form, stations: await resultRows(page) }
}

async function expectClean(page: Page, clean: Awaited<ReturnType<typeof cleanNumbers>>) {
  await runSql(page, clean.formSql)
  await expect(result(page)).toContainText('percentual_validos', { timeout: 20_000 })
  expect(await resultRows(page)).toEqual(clean.form)
  await runSql(page, STATION_SUM)
  await expect(result(page)).toBeVisible({ timeout: 20_000 })
  expect(await resultRows(page)).toEqual(clean.stations)
}

test("a visitor's macros, schemas and databases never reach the next run", async ({ page }) => {
  await open(page)
  const clean = await cleanNumbers(page)
  await runSql(
    page,
    [
      'CREATE MACRO round(x, d) AS 99',
      'CREATE TEMP MACRO read_parquet(p) AS TABLE SELECT 1 AS votos',
      'CREATE TEMP VIEW votos_secao AS SELECT 1 AS votos',
      'CREATE SCHEMA s',
      "SET search_path = 's,main'",
      "ATTACH ':memory:' AS other",
      'USE other',
      'SELECT 1 AS pronto',
    ].join(';\n'),
  )
  await expect(result(page)).toContainText('pronto', { timeout: 20_000 })
  await expectClean(page, clean)
})

test("no write of a visitor's reaches a checked file", async ({ page }) => {
  await open(page)
  const clean = await cleanNumbers(page)
  const chosen = '/consultas/2026/t1/totais/municipio/cargo=1/uf=AC.parquet'
  await runSql(
    page,
    `COPY (SELECT * FROM votos_municipio LIMIT 1) TO '${chosen}' (FORMAT parquet, USE_TMP_FILE false)`,
  )
  await expect(status(page).locator('pre')).not.toBeEmpty({ timeout: 20_000 })
  await expect(result(page)).toHaveCount(0)
  await runSql(
    page,
    [
      `ATTACH '${chosen}' AS other`,
      'CREATE TABLE other.t AS SELECT 1 AS x',
      'CHECKPOINT other',
      'DETACH other',
      'SELECT count(*) AS n FROM votos_municipio',
    ].join(';\n'),
  )
  await expect(status(page).or(result(page))).toBeVisible({ timeout: 20_000 })
  await expectClean(page, clean)
})

for (const [label, file] of [
  ['module', '**/duckdb-eh.wasm'],
  ['Parquet extension', '**/parquet.duckdb_extension.wasm'],
] as const) {
  test(`a failed ${label} download shows an error and a retry, and the retry works`, async ({
    page,
  }) => {
    await page.route(file, (route) => route.abort())
    await open(page)
    await page.getByRole('button', { name: '▶ Executar' }).click()
    await expect(status(page)).toContainText('O mecanismo de consulta não carregou', {
      timeout: 40_000,
    })
    await expect(status(page)).not.toContainText('Iniciando')
    await expect(result(page)).toHaveCount(0)
    await page.unroute(file)
    await page.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(result(page)).toBeVisible({ timeout: 40_000 })
  })
}

test('a file whose bytes differ from its pin shows an error and a retry, with no rows', async ({
  page,
}) => {
  const tampered = '**/_fixtures/data/2026/t1/totais/municipio/cargo=1/uf=AC.parquet'
  await page.route(tampered, (route) => route.fulfill({ body: 'not the pinned bytes' }))
  await open(page)
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(status(page)).toContainText('não confere com o manifesto', { timeout: 40_000 })
  await expect(result(page)).toHaveCount(0)
  await page.unroute(tampered)
  await page.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
})

test("the tables panel shows each table's size for the choice", async ({ page }) => {
  const sizeOf = (pattern: RegExp) =>
    fixtureManifest()
      .arquivos.filter((entry) => pattern.test(entry.path))
      .reduce((total, entry) => total + entry.size, 0)
  await open(page)
  await page.getByText('Tabelas e colunas (9)').click()
  await expect(page.getByTestId('table-size-votos_municipio')).toHaveText(
    formatBytes('pt', sizeOf(/^2026\/t1\/totais\/municipio\/cargo=1\//)),
  )
  await open(page, linkTo({ choice: { rounds: [1], races: [1], areas: ['ac'] } }))
  await page.getByText('Tabelas e colunas (9)').click()
  await expect(page.getByTestId('table-size-votos_municipio')).toHaveText(
    formatBytes('pt', sizeOf(/^2026\/t1\/totais\/municipio\/cargo=1\/uf=AC/)),
  )
})

const COUNTS =
  'SELECT (SELECT count(*) FROM votos_secao) + (SELECT count(*) FROM comparecimento_secao) + (SELECT count(*) FROM secoes) AS linhas'

test('a large download asks first, and requests nothing until the visitor confirms', async ({
  page,
}) => {
  const seen = requests(page)
  await open(
    page,
    linkTo({
      choice: { rounds: [1], races: [1, 3, 5, 6, 7, 25], areas: ['br'] },
      sql: COUNTS,
    }),
  )
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(status(page)).toContainText('Esta consulta vai baixar')
  await page.waitForTimeout(500)
  expect(seen.filter((url) => url.endsWith('.parquet'))).toEqual([])
  await page.getByRole('button', { name: 'Baixar e executar' }).click()
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
})

test('a query edited after the question asks again for its larger download', async ({ page }) => {
  const seen = requests(page)
  await open(
    page,
    linkTo({ choice: { rounds: [1], races: [1, 3, 5, 6, 7, 25], areas: ['br'] }, sql: COUNTS }),
  )
  await page.getByRole('button', { name: '▶ Executar' }).click()
  const question = status(page).getByText('Esta consulta vai baixar')
  await expect(question).toBeVisible()
  const first = await question.textContent()
  await editor(page).fill(`${COUNTS} + (SELECT count(*) FROM candidatos)`)
  await page.getByRole('button', { name: 'Baixar e executar' }).click()
  await expect(question).not.toHaveText(first ?? '')
  await page.waitForTimeout(500)
  expect(seen.filter((url) => url.endsWith('.parquet'))).toEqual([])
})

test('a cancelled query stops within two seconds, and the next run works', async ({ page }) => {
  await open(page)
  await runSql(page, 'SELECT count(*) FROM range(100000000000) t(i) WHERE i % 7 = 3')
  await expect(status(page)).toContainText('Executando a consulta', { timeout: 40_000 })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '■ Cancelar' }).click()
  await expect(status(page)).toContainText('Consulta cancelada', { timeout: 2000 })
  await expect(result(page)).toHaveCount(0)
  await runSql(page, 'SELECT 42 AS resposta')
  await expect(result(page)).toContainText('42', { timeout: 40_000 })
})

test('a result of more than 1,000,000 rows states that size, and the page answers to typing', async ({
  page,
}) => {
  await open(page)
  await runSql(page, "SELECT i, repeat('x', 40) AS texto FROM range(1200000) t(i)")
  await expect(status(page)).toContainText('Executando a consulta', { timeout: 40_000 })
  await editor(page).press('End')
  await editor(page).pressSequentially(' -- ok')
  await expect(editor(page)).toHaveValue(
    "SELECT i, repeat('x', 40) AS texto FROM range(1200000) t(i) -- ok",
    { timeout: 1000 },
  )
  await page.mouse.wheel(0, 300)
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 1000 }).toBeGreaterThan(0)
  await expect(status(page)).toContainText('Executando a consulta')
  await expect(page.getByTestId('playground-limit')).toContainText('mais de 1.000.000 de linhas', {
    timeout: 40_000,
  })
  await expect(page.getByTestId('playground-limit').getByRole('link')).toHaveAttribute(
    'href',
    '/2026/fontes/',
  )
  await expect(result(page).locator('tbody tr')).toHaveCount(1000)
  await expect(page.getByRole('button', { name: 'Baixar CSV' })).toHaveCount(0)
})

test('a result of very wide rows stops at 100 MB of CSV text, and the tab keeps working', async ({
  page,
}) => {
  await open(page)
  await runSql(page, "SELECT repeat('x', 1000000) AS texto FROM range(200) t(i)")
  await expect(page.getByTestId('playground-limit')).toContainText('passa de 100 MB', {
    timeout: 60_000,
  })
  const cell = await result(page).locator('tbody td').first().textContent()
  expect(cell?.length).toBe(501)
  await runSql(page, 'SELECT 42 AS resposta')
  await expect(result(page)).toContainText('42', { timeout: 40_000 })
})

test('the editor holds at most 10,000 characters, and says so', async ({ page }) => {
  await open(page)
  await editor(page).fill(`SELECT 1 -- ${'x'.repeat(10_100)}`)
  expect((await editor(page).inputValue()).length).toBe(10_000)
  await expect(page.getByTestId('playground-too-long')).toBeVisible()
})

test('a link pasted into an open page asks before it replaces a typed query', async ({ page }) => {
  await open(page)
  await editor(page).fill('SELECT 1 AS minha')
  const link = linkTo({
    choice: { rounds: [1], races: [1], areas: ['ac'] },
    sql: 'SELECT 2 AS dela',
  })
  await page.evaluate(
    (fragment) => {
      window.location.hash = fragment
    },
    link.slice(link.indexOf('#')),
  )
  await expect(page.getByText('Trocar a consulta que você escreveu?')).toBeVisible()
  await page.getByRole('button', { name: 'Manter a minha' }).click()
  await expect(editor(page)).toHaveValue('SELECT 1 AS minha')
  const other = linkTo({
    choice: { rounds: [1], races: [3], areas: ['pe'] },
    sql: 'SELECT 3 AS outra',
  })
  await page.evaluate(
    (fragment) => {
      window.location.hash = fragment
    },
    other.slice(other.indexOf('#')),
  )
  await page.getByRole('button', { name: 'Trocar' }).click()
  await expect(editor(page)).toHaveValue('SELECT 3 AS outra')
  await expect(page.getByTestId('playground-area-summary')).toHaveText('Pernambuco')
  await expect(result(page)).toHaveCount(0)
})

test("a query over the memory limit shows the engine's error, and the tab keeps working", async ({
  page,
}) => {
  await open(page)
  await runSql(page, 'SELECT max(len(l)) FROM (SELECT list(i) AS l FROM range(400000000) t(i))')
  await expect(status(page).locator('pre')).toContainText(/Out of Memory|memory/i, {
    timeout: 60_000,
  })
  await expect(result(page)).toHaveCount(0)
  await runSql(page, 'SELECT 42 AS resposta')
  await expect(result(page)).toContainText('42', { timeout: 40_000 })
})

test("the form's votes and shares for one candidate in Acre equal each municipality's page", async ({
  page,
}) => {
  await open(page, linkTo({ choice: { rounds: [1], races: [1], areas: ['ac'] } }))
  await form(page).getByLabel('Pergunta').selectOption('one')
  await form(page).getByLabel('Nível').selectOption('municipio')
  await expect(form(page).getByLabel('Candidato')).toContainText('13 · Lula (PT)')
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  const rows = await resultRows(page)
  const rioBranco = rows.find((row) => row[1] === 'RIO BRANCO')
  expect(rioBranco).toBeDefined()
  await page.goto('/2026/municipio/?uf=ac&mu=1392')
  const lula = page.getByRole('row', { name: /^Lula/ })
  await expect(lula).toBeVisible({ timeout: 30_000 })
  const cells = (await lula.locator('td').allTextContents()).map((cell) => cell.trim())
  expect(cells).toContain(rioBranco?.[2])
  expect(cells).toContain(`${rioBranco?.[3]}%`)
})

test("a result's CSV holds municipality names as the published files hold them", async ({
  page,
}) => {
  await open(page, linkTo({ choice: { rounds: [1], races: [1], areas: ['ac'] } }))
  await form(page).getByLabel('Pergunta').selectOption('one')
  await form(page).getByLabel('Nível').selectOption('municipio')
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar CSV' }).click()
  const text = readFileSync(await (await downloading).path(), 'utf-8')
  expect(text).toContain(',RIO BRANCO,')
  expect(text).not.toContain('Rio Branco')
})

test('the CSV of a query that reads no table names no round', async ({ page }) => {
  await open(page)
  await runSql(page, 'SELECT 42 AS resposta')
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar CSV' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('consulta-2026.csv')
  const lines = readFileSync(await download.path(), 'utf-8').split('\r\n')
  expect(lines.filter((line) => /^# \dº turno/.test(line))).toEqual([])
})

test("the form's turnout by state equals each state's page", async ({ page }) => {
  await open(page)
  await form(page).getByLabel('Pergunta').selectOption('turnout')
  await form(page).getByLabel('Ordem').selectOption('place')
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  const format = (value: number) => new Intl.NumberFormat('pt-BR').format(value)
  const rows = await resultRows(page)
  expect(rows.map((row) => row[0])).toEqual(['AC', 'PE', 'SE', 'ZZ'])
  for (const row of rows) {
    const president = summary(String(row[0]).toLowerCase()).corridas.find(
      (race) => race.cargo === 1,
    )
    expect(row.slice(1, 4)).toEqual([
      format(president?.aptos ?? -1),
      format(president?.comparecimento ?? -1),
      format(president?.abstencoes ?? -1),
    ])
  }
})

test('with both rounds, the form lists each municipality once for each round', async ({ page }) => {
  await open(page, linkTo({ choice: { rounds: [1, 2], races: [1], areas: ['ac'] } }))
  await form(page).getByLabel('Pergunta').selectOption('one')
  await form(page).getByLabel('Nível').selectOption('municipio')
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  const rows = await resultRows(page)
  const keys = rows.map((row) => `${row[0]}/${row[2]}`)
  expect(new Set(keys).size).toBe(keys.length)
  expect(new Set(rows.map((row) => row[0]))).toEqual(new Set(['1', '2']))
  await expect(page.getByTestId('playground-caption')).toContainText('2º turno: versão teste')
})

for (const example of EXAMPLES) {
  test(`the example ${example.id} runs and returns rows`, async ({ page }) => {
    await open(page)
    await page.getByRole('combobox', { name: 'Exemplos' }).selectOption(example.id)
    await expect(editor(page)).toHaveValue(example.sql)
    await page.getByRole('button', { name: '▶ Executar' }).click()
    await expect(result(page)).toBeVisible({ timeout: 40_000 })
    expect((await resultRows(page)).length).toBeGreaterThan(0)
  })
}

test('the page asks before the form replaces a query that the visitor typed', async ({ page }) => {
  await open(page)
  await editor(page).fill('SELECT 1 AS minha')
  await form(page).getByLabel('Nível').selectOption('municipio')
  await expect(page.getByText('Trocar a consulta que você escreveu?')).toBeVisible()
  await page.getByRole('button', { name: 'Manter a minha' }).click()
  await expect(editor(page)).toHaveValue('SELECT 1 AS minha')
})

for (const shortcut of ['Control+Enter', 'Meta+Enter']) {
  test(`${shortcut} in the editor runs the query`, async ({ page }) => {
    await open(page)
    await editor(page).fill('SELECT 42 AS resposta')
    await editor(page).press(shortcut)
    await expect(result(page)).toContainText('42', { timeout: 40_000 })
  })
}

test('the page asks before an example replaces a query that the visitor typed', async ({
  page,
}) => {
  await open(page)
  await editor(page).fill('SELECT 1 AS minha')
  await page.getByRole('combobox', { name: 'Exemplos' }).selectOption(EXAMPLES[0]?.id ?? '')
  await expect(page.getByText('Trocar a consulta que você escreveu?')).toBeVisible()
  await page.getByRole('button', { name: 'Manter a minha' }).click()
  await expect(editor(page)).toHaveValue('SELECT 1 AS minha')
})

test('a long query folds after four lines, and a query of invented numbers keeps its caption', async ({
  page,
}) => {
  await open(page)
  const lines = [
    'SELECT',
    ...Array.from({ length: 15 }, (_, index) => `  ${index} AS c${index},`),
    "  'Fulano' AS candidato",
  ]
  await runSql(page, lines.join('\n'))
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  await expect(page.getByTestId('playground-result-sql')).toHaveText(lines.slice(0, 4).join('\n'))
  await page.getByRole('button', { name: 'Mostrar a consulta inteira · mais 13 linhas' }).click()
  await expect(page.getByTestId('playground-result-sql')).toHaveText(lines.join('\n'))

  await runSql(page, "SELECT 'Fulano' AS candidato, 99 AS votos")
  await expect(result(page)).toContainText('Fulano', { timeout: 20_000 })
  await expect(page.getByTestId('playground-caption')).toContainText(
    'Resultado de uma consulta de visitante sobre dados oficiais do TSE.',
  )
  await expect(page.getByTestId('playground-result-sql')).toHaveText(
    "SELECT 'Fulano' AS candidato, 99 AS votos",
  )
})

test('the CSV holds the credit, the version and the link, then the header and the rows', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar CSV' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('consulta-2026-t1-teste.csv')
  const file = await download.path()
  const text = readFileSync(file, 'utf-8')
  const lines = text.split('\r\n')
  expect(text.startsWith('﻿# Fonte: Tribunal Superior Eleitoral (TSE)')).toBe(true)
  expect(lines[1]).toBe('# 1º turno: versão teste')
  expect(lines[2]).toMatch(
    /^# Consulta: http:\/\/127\.0\.0\.1:\d+\/2026\/consultas\/#c=[A-Za-z0-9_-]+$/,
  )
  expect(lines[3]).toBe('uf,numero,candidato,partido,votos,percentual_validos')
  expect(lines[4]).toMatch(/^[A-Z]{2},\d+,/)
})

test("a round-2 query that reads `municipios` names round 1's version in its caption, CSV and link", async ({
  page,
}) => {
  await open(
    page,
    linkTo({
      choice: { rounds: [2], races: [1], areas: ['ac'] },
      sql: 'SELECT count(*) AS n FROM municipios',
    }),
  )
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  await expect(page.getByTestId('playground-caption')).toContainText('1º turno: versão teste')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar CSV' }).click()
  const lines = readFileSync(await (await downloading).path(), 'utf-8').split('\r\n')
  expect(lines[1]).toBe('# 1º turno: versão teste')
  const fragment = (lines[2] ?? '').split('#c=')[1] ?? ''
  const payload = JSON.parse(
    Buffer.from(fragment.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf-8'),
  ) as { versoes: Record<string, string>; turnos: number[] }
  expect(payload.turnos).toEqual([2])
  expect(payload.versoes).toEqual({ 1: 'teste', 2: 'teste' })
})

test('a link restores its query and its choice, and runs nothing until the visitor runs it', async ({
  page,
}) => {
  const seen = requests(page)
  await open(
    page,
    linkTo({ choice: { rounds: [1], races: [3], areas: ['ac'] }, sql: 'SELECT 42 AS resposta' }),
  )
  await expect(editor(page)).toHaveValue('SELECT 42 AS resposta')
  await expect(page.getByTestId('playground-area-summary')).toHaveText('Acre')
  await expect(page.getByRole('button', { name: 'Governador' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByText('A consulta do link foi restaurada.')).toBeVisible()
  await page.waitForTimeout(1000)
  expect(seen.filter((url) => ENGINE_FILES.test(url))).toEqual([])
  await expect(result(page)).toHaveCount(0)
  await page.getByRole('button', { name: '▶ Executar' }).click()
  await expect(result(page)).toContainText('42', { timeout: 40_000 })
})

test('a link from an earlier version names both versions', async ({ page }) => {
  await open(
    page,
    `${PAGE}${linkFragment({
      versions: { 1: '20261001-aaaaaaa-1' },
      choice: { rounds: [1], races: [1], areas: ['br'] },
      sql: 'SELECT 1',
    })}`,
  )
  await expect(page.getByText(/feito sobre a versão 20261001-aaaaaaa-1 do 1º turno/)).toBeVisible()
  await expect(page.getByText(/agora usa a versão teste/)).toBeVisible()
})

test('an invalid link restores nothing, and requests no file', async ({ page }) => {
  const seen = requests(page)
  await open(page, `${PAGE}#c=eyJ2IjoxLCJhcmVhcyI6WyIuLi94Il19`)
  await expect(page.getByText('Este link de consulta não é válido.')).toBeVisible()
  await expect(page.getByTestId('playground-area-summary')).toHaveText('Brasil inteiro')
  await page.waitForTimeout(500)
  expect(seen.filter((url) => ENGINE_FILES.test(url))).toEqual([])
})

test('at 360 pixels every control fits, and a wide result scrolls inside its frame with its caption whole', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await open(page)
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(await overflow()).toBeLessThanOrEqual(0)
  await runSql(
    page,
    'SELECT m.nome, c.* FROM comparecimento_municipio c JOIN municipios m ON m.municipio = c.municipio',
  )
  await expect(result(page)).toBeVisible({ timeout: 40_000 })
  await expect(result(page).locator('thead th')).toHaveCount(12)
  expect(await overflow()).toBeLessThanOrEqual(0)
  const scroller = page.getByTestId('playground-result-scroll')
  await scroller.evaluate((element) => {
    element.scrollLeft = 400
  })
  expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  const box = await page.getByTestId('playground-caption').boundingBox()
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 1000)).toBeLessThanOrEqual(360)
})

test('the English page runs in English', async ({ page }) => {
  await page.goto('/en/2026/consultas/')
  await expect(page.getByRole('heading', { name: 'Queries', level: 1 })).toBeVisible()
  await expect(page.getByLabel('SQL · you can edit it')).toBeVisible()
  await page.getByRole('button', { name: '▶ Run' }).click()
  await expect(page.getByTestId('playground-caption')).toContainText(
    "Result of a visitor's query over TSE's official data.",
    { timeout: 40_000 },
  )
})
