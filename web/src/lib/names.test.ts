import { describe, expect, it } from 'vitest'
import { displayName } from './names'

describe('displayName', () => {
  it.each([
    ['FLAVIO BOLSONARO', 'Flavio Bolsonaro'],
    ['MARIA DA SILVA', 'Maria da Silva'],
    ['ZE DO PT', 'Ze do PT'],
    ['BIA DO PSOL', 'Bia do PSOL'],
    ['LU DO NOVO', 'Lu do Novo'],
    ['ZE DA ONG', 'Ze da ONG'],
    ['DR. ANA LIMA', 'Dr. Ana Lima'],
    ['DR.ANA LIMA', 'Dr.Ana Lima'],
    ['LU ENFERMEIRA/PROFESSORA', 'Lu Enfermeira/Professora'],
    ['ABREU E LIMA', 'Abreu e Lima'],
    ["PAU D'ARCO", "Pau d'Arco"],
  ])('follows the spec: %s', (name, expected) => {
    expect(displayName(name)).toBe(expected)
  })

  it.each([
    ['ANA MARIA-JOSÉ', 'Ana Maria-José'],
    ['"DOUTOR" JOÃO', '"Doutor" João'],
    ['MARIA (DO POVO)', 'Maria (Do Povo)'],
    ['JOÃO 007', 'João 007'],
    ['DRª. LÚCIA', 'Drª. Lúcia'],
    ["OLHO D'ÁGUA", "Olho d'Água"],
    ["D'ÁVILA SANTOS", "D'Ávila Santos"],
    ['SGT ROCHA E CB LIMA', 'Sgt Rocha e CB Lima'],
    ['JOÃO DO BH', 'João do BH'],
    ['DE ASSIS', 'De Assis'],
    ['CAPITÃO ÉDSON JR', 'Capitão Édson Jr'],
  ])('handles punctuation, titles and particles: %s', (name, expected) => {
    expect(displayName(name)).toBe(expected)
  })

  it('changes only the case', () => {
    const names = ['JOSÉ  DA   SILVA', 'ÚRSULA ÇAMPOS', '777']
    for (const name of names) {
      expect(displayName(name).toLocaleUpperCase('pt-BR')).toBe(name)
    }
    expect(displayName('777')).toBe('777')
  })
})
