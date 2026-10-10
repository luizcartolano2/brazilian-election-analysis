/**
 * Fails when a page in the static export, counting the values files it loads, exceeds the size
 * that a phone loads well.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export const MAX_PAGE_BYTES = 2_500_000

export interface PageSize {
  page: string
  bytes: number
  html: number
  /** Each values file that the page loads, with its size. */
  files: { url: string; bytes: number }[]
}

/** The values files that a page names, as their addresses in the static export. */
export function valuesFilesOf(html: string): string[] {
  return [...new Set(html.match(/\/mapas\/t[12]\/[a-z]{2}\/[0-9a-z-]+\.[0-9a-f]{16}\.json/g))]
}

/** Every HTML file under `folder` that, with its values files, exceeds `limit`, largest first. */
export async function oversizedPages(folder: string, limit = MAX_PAGE_BYTES): Promise<PageSize[]> {
  const found: PageSize[] = []
  const sizes = new Map<string, number>()
  const sizeOf = async (url: string) => {
    let size = sizes.get(url)
    if (size === undefined) {
      size = (await stat(path.join(folder, url))).size
      sizes.set(url, size)
    }
    return size
  }
  for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue
    const file = path.join(entry.parentPath, entry.name)
    const html = (await stat(file)).size
    const files = []
    for (const url of valuesFilesOf(await readFile(file, 'utf-8'))) {
      try {
        files.push({ url, bytes: await sizeOf(url) })
      } catch {
        throw new Error(`${path.relative(folder, file)} loads ${url}, which the export lacks`)
      }
    }
    const bytes = html + files.reduce((sum, item) => sum + item.bytes, 0)
    if (bytes > limit) found.push({ page: path.relative(folder, file), bytes, html, files })
  }
  return found.sort((a, b) => b.bytes - a.bytes)
}

async function main(folder: string): Promise<void> {
  const oversized = await oversizedPages(folder)
  if (oversized.length > 0) {
    for (const { page, bytes, html, files } of oversized) {
      const parts = [`${html} of HTML`, ...files.map((item) => `${item.bytes} in ${item.url}`)]
      console.error(`${page} is ${bytes} bytes (${parts.join(', ')}), over ${MAX_PAGE_BYTES}`)
    }
    process.exit(1)
  }
  console.log(`every page in ${folder}, with its values files, is within ${MAX_PAGE_BYTES} bytes`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv[2] ?? 'out').catch((error: unknown) => {
    console.error(`page-size failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
}
