/**
 * Serves out/ the way Vercel will: every header and redirect from vercel.json, trailing-slash
 * folders as index.html, and 404.html for anything else. Playwright tests the build through it.
 */
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', 'out')
const PORT = Number(process.env.PORT ?? 3100)
const config = JSON.parse(
  await readFile(path.resolve(import.meta.dirname, '..', 'vercel.json'), 'utf-8'),
)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
}

function matches(source, pathname) {
  return new RegExp(`^${source}$`).test(pathname)
}

function headersFor(pathname) {
  return config.headers
    .filter((rule) => matches(rule.source, pathname))
    .flatMap((rule) => rule.headers.map((header) => [header.key, header.value]))
}

async function fileFor(pathname) {
  const target = path.join(ROOT, decodeURIComponent(pathname))
  if (!target.startsWith(ROOT)) return null
  try {
    const info = await stat(target)
    if (info.isFile()) return target
    if (info.isDirectory()) {
      const index = path.join(target, 'index.html')
      return (await stat(index)).isFile() ? index : null
    }
  } catch {
    return null
  }
  return null
}

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  for (const [name, value] of headersFor(pathname)) response.setHeader(name, value)

  const redirect = config.redirects.find((rule) => rule.source === pathname)
  if (redirect) {
    response.writeHead(307, { Location: redirect.destination }).end()
    return
  }
  if (!pathname.endsWith('/') && !path.extname(pathname)) {
    response.writeHead(308, { Location: `${pathname}/` }).end()
    return
  }
  const file = await fileFor(pathname)
  if (file === null) {
    response.writeHead(404, { 'Content-Type': TYPES['.html'] })
    createReadStream(path.join(ROOT, '404.html')).pipe(response)
    return
  }
  response.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
  })
  createReadStream(file).pipe(response)
}).listen(PORT, '127.0.0.1', () => {
  console.log(`serving out/ on http://127.0.0.1:${PORT}`)
})
