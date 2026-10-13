/**
 * Checks every pinned data version through the Worker, as a published build does, without
 * building. CI runs it on every PR, because CI builds the fixtures and never reads a pin.
 */
import path from 'node:path'
import { loadRounds, plannedRounds } from './prepare-data'

async function main(): Promise<void> {
  for (const round of await loadRounds(plannedRounds('published'))) {
    console.log(
      `pin: round ${round.round} ${round.pin?.name}, ${round.summaries.size} summaries and ${round.races.length} races checked`,
    )
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((error: unknown) => {
    console.error(`check-pins failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
}
