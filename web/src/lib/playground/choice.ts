/** The data a visitor chooses before a query. */
import type { Round } from '../elections'
import type { PlaygroundFile } from './files'

/** `br` stands for Brazil: every state and the votes cast abroad. */
export const BRAZIL = 'br'

export interface DataChoice {
  rounds: Round[]
  races: number[]
  /** `['br']`, or chosen states and `zz`, in lower case. */
  areas: string[]
}

export function isBrazil(choice: DataChoice): boolean {
  return choice.areas.includes(BRAZIL)
}

export function sizeOf(files: PlaygroundFile[]): number {
  return files.reduce((total, file) => total + file.size, 0)
}

/** The name under which the engine holds a file: fixed, and never built from typed text. */
export function registeredName(file: PlaygroundFile): string {
  return `/consultas/${file.path}`
}
