/** Title case for TSE's names of candidates, municipalities and cities abroad, which TSE writes in capitals. */

const PARTICLES = new Set(['DA', 'DAS', 'DE', 'DO', 'DOS', 'E'])
// Abbreviated titles, which have no vowel and so would otherwise stay in capitals.
const TITLES = new Set(['CMDT', 'DR', 'JR', 'SGT', 'SR'])
// Acronyms that hold a vowel. A party name that is also a word, such as NOVO, is not one.
const ACRONYMS = new Set(['COHAB', 'CUT', 'ONG', 'PCO', 'PSOL', 'PSTU', 'SAMU'])

const SEGMENT = /[\p{L}\p{N}ªº°]+|[^\p{L}\p{N}ªº°]+/gu
const LETTERS = /[\p{L}\p{N}]/u
const VOWEL = /[AEIOUY]/u
const MARKS = /\p{M}/gu
const ORDINALS = /[ªº°]/gu
const APOSTROPHE = /^['’]/u

function capitalize(segment: string): string {
  const lower = segment.toLocaleLowerCase('pt-BR')
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
}

function recaseSegment(segment: string): string {
  const core = segment.replace(ORDINALS, '').toLocaleUpperCase('pt-BR')
  if (TITLES.has(core)) return capitalize(segment)
  if (ACRONYMS.has(core) || !VOWEL.test(core.normalize('NFD').replace(MARKS, ''))) return segment
  return capitalize(segment)
}

function recaseWord(word: string, first: boolean): string {
  if (!first && PARTICLES.has(word.toLocaleUpperCase('pt-BR'))) {
    return word.toLocaleLowerCase('pt-BR')
  }
  const parts = word.match(SEGMENT) ?? []
  return parts
    .map((part, index) => {
      if (!LETTERS.test(part)) return part
      // "PAU D'ARCO" becomes "Pau d'Arco", but a name that starts with "D'" keeps its capital.
      if (!first && index === 0 && part.toUpperCase() === 'D' && APOSTROPHE.test(parts[1] ?? '')) {
        return 'd'
      }
      return recaseSegment(part)
    })
    .join('')
}

/** The name with each word in title case, and acronyms, initials and particles as Portuguese writes them. */
export function displayName(name: string): string {
  let first = true
  return name.replace(/\S+/gu, (word) => {
    const recased = recaseWord(word, first)
    first = false
    return recased
  })
}
