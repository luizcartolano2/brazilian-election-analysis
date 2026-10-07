/** Serves published data versions and the query engine's WebAssembly file from R2, read only. */

import { corsHeaders, PREFLIGHT_HEADERS } from "./cors";
import { keyFromUrl } from "./keys";
import { type ByteRange, parseRange } from "./range";

export interface Env {
  DATA: R2Bucket;
  VERCEL_TEAM_SLUG: string;
}

const IMMUTABLE = "public, max-age=31536000, immutable";

// R2 keeps whatever type the uploader guessed, and a browser compiles WebAssembly as it
// streams only when the type is `application/wasm`.
const CONTENT_TYPES: Record<string, string> = {
  json: "application/json; charset=utf-8",
  parquet: "application/vnd.apache.parquet",
  wasm: "application/wasm",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = new Headers({
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(request.headers.get("Origin"), env.VERCEL_TEAM_SLUG),
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
    if (method === "HEAD") return head(env.DATA, key, headers);
    return get(env.DATA, key, request.headers.get("Range"), headers);
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
  if (rangeHeader !== null) {
    // The size decides between a part, the whole file and 416, so it is read first.
    const metadata = await bucket.head(key);
    if (metadata === null) return new Response(null, { status: 404, headers });
    const parsed = parseRange(rangeHeader, metadata.size);
    if (parsed === "unsatisfiable") {
      headers.set("Content-Range", `bytes */${metadata.size}`);
      return new Response(null, { status: 416, headers });
    }
    if (parsed !== "whole") range = parsed;
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
  headers.set("Content-Type", CONTENT_TYPES[extension] ?? "application/octet-stream");
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", IMMUTABLE);
}
