import { describe, expect, it } from 'vitest'
import { csvCell, csvFileName, csvLine, csvPreamble } from './csv'
import { linkFragment } from './link'
import { ResultCollector } from './result'

const CREDIT =
  'Fonte: Tribunal Superior Eleitoral (TSE), Portal de Dados Abertos. Processamento: Brazilian Election Analysis (github.com/luizcartolano2/brazilian-election-analysis).'

function fileText(collector: ResultCollector, comments: string[]): string {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
  return collector
    .fileParts(comments)
    .map((part) => decoder.decode(part, { stream: true }))
    .join('')
}

describe('the CSV file', () => {
  it('starts with a byte order mark and the comment lines, then the header and the rows', () => {
    const collector = new ResultCollector([
      { name: 'uf', type: 'Utf8' },
      { name: 'votos', type: 'Int64' },
    ])
    collector.add([['AC', 56423n]])
    const text = fileText(collector, [
      CREDIT,
      '1º turno: versão 20261007-67d59ff-37656362427',
      'Consulta: https://x/#c=abc',
    ])
    expect(text).toBe(
      `\uFEFF# ${CREDIT}\r\n# 1º turno: versão 20261007-67d59ff-37656362427\r\n# Consulta: https://x/#c=abc\r\nuf,votos\r\nAC,56423\r\n`,
    )
  })

  it('quotes as RFC 4180 does', () => {
    expect(csvLine(['a,b', 'say "hi"', 'two\nlines', 'plain'])).toBe(
      '"a,b","say ""hi""","two\nlines",plain\r\n',
    )
  })

  it.each(['=', '+', '-', '@', '\t', '\r', '\n'])(
    'writes a text that starts with %j as text, in a cell and in the header',
    (start) => {
      const cell = csvCell(`${start}1+1`)
      expect(cell.replace(/^"/, '').startsWith(`'${start}`)).toBe(true)
      const collector = new ResultCollector([{ name: `${start}x`, type: 'Utf8' }])
      expect(
        fileText(collector, [])
          .split('\r\n')[0]
          ?.replace(/^\uFEFF?"?/, '')
          .startsWith(`'${start}`),
      ).toBe(true)
    },
  )

  it('leaves a negative number as a number', () => {
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(-5n)).toBe('-5')
    expect(csvCell(-0.5)).toBe('-0.5')
  })

  it('names the file for each round and data version', () => {
    expect(csvFileName([{ round: 1, version: '20261007-67d59ff-37656362427' }])).toBe(
      'consulta-2026-t1-20261007-67d59ff-37656362427.csv',
    )
    expect(
      csvFileName([
        { round: 1, version: '20261007-67d59ff-37656362427' },
        { round: 2, version: '20261027-abc1234-1' },
      ]),
    ).toBe('consulta-2026-t1-20261007-67d59ff-37656362427-t2-20261027-abc1234-1.csv')
  })

  it('refuses a comment line with a line break', () => {
    expect(() => csvPreamble(['one\ntwo'])).toThrow(/line break/)
  })

  it.each([';', '\t', '\n', '\r'])(
    'writes a text with %j before a formula as text, in a cell and in the header',
    (separator) => {
      expect(csvCell(`x${separator}=1+1`).replace(/^"|"$/g, '')).toBe(`x${separator}'=1+1`)
      const collector = new ResultCollector([{ name: `a${separator}@SUM(1)`, type: 'Utf8' }])
      expect(fileText(collector, [])).toContain(`a${separator}'@SUM(1)`)
    },
  )

  it('holds no cell that a spreadsheet runs, whatever the query from a link holds', () => {
    const sql = 'SELECT 1 AS "=1+1" -- ,=HYPERLINK("https://example.org")\n-- ;=1+1\rFROM range(1)'
    const link = `https://eleicoes.luizcartolano.com/2026/consultas/${linkFragment({
      versions: { 1: '20261007-67d59ff-37656362427' },
      choice: { rounds: [1], races: [1], areas: ['br'] },
      sql,
    })}`
    const collector = new ResultCollector([
      { name: '=1+1', type: 'Int32' },
      { name: 'a;=1+1', type: 'Utf8' },
      { name: 'texto', type: 'Utf8' },
    ])
    collector.add([
      [1, 'x;=1+1', '=HYPERLINK("https://example.org")'],
      [2, 'x\t=1+1', 'x\n=1+1'],
      [3, 'x\r@SUM(1)', "y;=cmd|' /C calc'!A0"],
    ])
    const text = fileText(collector, [CREDIT, `Consulta: ${link}`]).replace(/^\uFEFF/, '')
    // Excel in Portuguese ignores the quotes of a comma-separated file and splits at semicolons,
    // so the check splits at every separator and line break, quotes or not.
    for (const line of text.split(/\r\n|\r|\n/)) {
      for (const piece of line.split(/[,;\t]/)) {
        expect(piece.replace(/^"/, ''), JSON.stringify(line)).not.toMatch(/^[=+\-@]/)
      }
    }
    expect(text).not.toContain('HYPERLINK("https://example.org")\r\n')
    expect(text).not.toContain(';=1+1')
  })
})
