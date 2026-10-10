/**
 * Deletes the navigation files that the app never requests. Its links never prefetch, so
 * client navigation reads each page's `index.txt` alone, and the segment files only use space.
 */
import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'

/** `__next._full.txt`, `__next._tree.txt` and each `__next.<segment>.txt`. */
const UNUSED = /^__next\..+\.txt$/

/** Deletes every unused navigation file under `folder`, and returns how many bytes it freed. */
export async function prunePayloads(folder: string): Promise<{ files: number; bytes: number }> {
  try {
    await stat(path.join(folder, '_next'))
  } catch {
    throw new Error(`${folder} holds no _next folder, so it is not a static export`)
  }
  let files = 0
  let bytes = 0
  for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !UNUSED.test(entry.name)) continue
    const file = path.join(entry.parentPath, entry.name)
    bytes += (await stat(file)).size
    await rm(file)
    files += 1
  }
  return { files, bytes }
}

async function main(folder: string): Promise<void> {
  const { files, bytes } = await prunePayloads(folder)
  console.log(`pruned ${files} unused navigation files, ${bytes} bytes, from ${folder}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv[2] ?? 'out').catch((error: unknown) => {
    console.error(`prune-payloads failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
}
