/** Serves published data versions and the query engine's WebAssembly file from R2, read only. */

import { corsHeaders, PREFLIGHT_HEADERS } from "./cors";
import { keyFromUrl } from "./keys";
import { type ByteRange, parseRangeHeader, resolveRange } from "./range";

export interface Env {
  DATA: R2Bucket;
}

const IMMUTABLE = "public, max-age=31536000, immutable";

// R2 keeps whatever type the uploader guessed, and a browser compiles WebAssembly as it
// streams only when the type is `application/wasm`. A Map, because a plain object would
// answer `constructor` and `__proto__` from its prototype.
const CONTENT_TYPES = new Map([
  ["json", "application/json; charset=utf-8"],
  ["parquet", "application/vnd.apache.parquet"],
  ["wasm", "application/wasm"],
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = new Headers({
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(request.headers.get("Origin")),
    });
    const method = request.method;
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      headers.set("Allow", "GET, HEAD, OPTIONS");
      return new Response(null, { status: 405, headers });
    }

    const key = keyFromUrl(request.url);
    if (key === null) return new Response(null, { status: 404, headers });

    if (method === "OPTIONS") {
      if (headers.has("Access-Control-Allow-Origin")) {
        for (const [name, value] of Object.entries(PREFLIGHT_HEADERS)) headers.set(name, value);
      }
      return new Response(null, { status: 204, headers });
    }

    // Without this, an R2 failure reaches the browser as the runtime's error page, which has
    // no CORS headers, so the app could not even read its status.
    try {
      if (method === "HEAD") return await head(env.DATA, key, headers);
      return await get(env.DATA, key, request.headers.get("Range"), headers);
    } catch (error) {
      console.error("R2 read failed", error);
      return new Response(null, { status: 503, headers });
    }
  },
} satisfies ExportedHandler<Env>;

async function head(bucket: R2Bucket, key: string, headers: Headers): Promise<Response> {
  const object = await bucket.head(key);
  if (object === null) return new Response(null, { status: 404, headers });
  describe(headers, key, object);
  headers.set("Content-Length", String(object.size));
  return new Response(null, { headers });
}

async function get(
  bucket: R2Bucket,
  key: string,
  rangeHeader: string | null,
  headers: Headers,
): Promise<Response> {
  let range: ByteRange | null = null;
  const spec = rangeHeader === null ? null : parseRangeHeader(rangeHeader);
  if (spec !== null) {
    // The size decides between a part and 416, so it is read first.
    const metadata = await bucket.head(key);
    if (metadata === null) return new Response(null, { status: 404, headers });
    const resolved = resolveRange(spec, metadata.size);
    if (resolved === "unsatisfiable") {
      headers.set("Content-Range", `bytes */${metadata.size}`);
      return new Response(null, { status: 416, headers });
    }
    range = resolved;
  }

  const object = await bucket.get(key, range === null ? {} : { range });
  if (object === null) return new Response(null, { status: 404, headers });
  describe(headers, key, object);
  if (range === null) {
    headers.set("Content-Length", String(object.size));
    return new Response(object.body, { headers });
  }
  const last = range.offset + range.length - 1;
  headers.set("Content-Range", `bytes ${range.offset}-${last}/${object.size}`);
  headers.set("Content-Length", String(range.length));
  return new Response(object.body, { status: 206, headers });
}

function describe(headers: Headers, key: string, object: R2Object): void {
  const extension = key.slice(key.lastIndexOf(".") + 1);
  headers.set("Content-Type", CONTENT_TYPES.get(extension) ?? "application/octet-stream");
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", IMMUTABLE);
}
