/** Fails when an HTML page in the static export exceeds the size that a phone loads well. */
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

export const MAX_PAGE_BYTES = 2_500_000

/** Every HTML file under `folder` larger than `limit` bytes, largest first. */
export async function oversizedPages(
  folder: string,
  limit = MAX_PAGE_BYTES,
): Promise<{ page: string; bytes: number }[]> {
  const found: { page: string; bytes: number }[] = []
  for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue
    const file = path.join(entry.parentPath, entry.name)
    const { size } = await stat(file)
    if (size > limit) found.push({ page: path.relative(folder, file), bytes: size })
  }
  return found.sort((a, b) => b.bytes - a.bytes)
}

async function main(folder: string): Promise<void> {
  const oversized = await oversizedPages(folder)
  if (oversized.length > 0) {
    for (const { page, bytes } of oversized) {
      console.error(`${page} is ${bytes} bytes, over the limit of ${MAX_PAGE_BYTES}`)
    }
    process.exit(1)
  }
  console.log(`every page in ${folder} is within ${MAX_PAGE_BYTES} bytes`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv[2] ?? 'out').catch((error: unknown) => {
    console.error(`page-size failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
}
