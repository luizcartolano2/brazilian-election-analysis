/**
 * Serves one folder on a free local port and prints the port. The Node build of DuckDB-WASM
 * fetches extensions synchronously, so the server must live in another process.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'

const root = path.resolve(process.argv[2] ?? '.')

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const target = path.join(root, pathname)
  try {
    if (!target.startsWith(root + path.sep) || !(await stat(target)).isFile()) throw new Error()
    response.writeHead(200, { 'Content-Type': 'application/wasm' })
    createReadStream(target).pipe(response)
  } catch {
    response.writeHead(404).end()
  }
})
server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  console.log(typeof address === 'object' && address !== null ? address.port : '')
})
