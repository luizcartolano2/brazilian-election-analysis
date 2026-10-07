/**
 * Copies the DuckDB assets into a folder for the publish workflow, with a SHA256SUMS list, and
 * prints `version=<package version>` for the workflow's output.
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assetFiles, duckdbPackageVersion, sha256Of } from './duckdb-assets'

async function main(target: string): Promise<void> {
  const lines: string[] = []
  for (const asset of await assetFiles()) {
    const destination = path.join(target, asset.path)
    await mkdir(path.dirname(destination), { recursive: true })
    await cp(asset.source, destination)
    lines.push(`${sha256Of(await readFile(destination))}  ${asset.path}`)
  }
  await writeFile(path.join(target, 'SHA256SUMS'), `${lines.sort().join('\n')}\n`)
  console.log(`version=${duckdbPackageVersion()}`)
}

main(path.resolve(process.argv[2] ?? 'duckdb-assets')).catch((error: unknown) => {
  console.error(`stage-duckdb-assets failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
