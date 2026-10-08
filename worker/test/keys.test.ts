import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { keyFromUrl } from "../src/keys";
import {
  BYTES,
  bytesOf,
  GEO_BUILD,
  GEO_FILE,
  JSON_FILE,
  PARQUET_FILE,
  PRODUCTION,
  request,
  requestWith,
  seed,
  SIZE,
  UNREADABLE_BUCKET,
  VERSION,
  WASM_FILE,
} from "./helpers";

beforeEach(seed);

describe("files inside a version", () => {
  it.each([
    [PARQUET_FILE, "application/vnd.apache.parquet"],
    [JSON_FILE, "application/json; charset=utf-8"],
    [WASM_FILE, "application/wasm"],
    [GEO_FILE, "application/json; charset=utf-8"],
  ])("serves %s as %s", async (key, contentType) => {
    const response = await request(`/${key}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(contentType);
    expect(response.headers.get("Content-Length")).toBe(String(SIZE));
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("ETag")).toBe((await env.DATA.head(key))?.httpEtag);
    expect(await bytesOf(response)).toEqual(BYTES);
  });

  it.each(["notes.txt", "a.constructor", "a.__proto__", "README"])(
    "serves %s as application/octet-stream",
    async (name) => {
      await env.DATA.put(`${VERSION}/${name}`, BYTES);

      const response = await request(`/${VERSION}/${name}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    },
  );

  it("answers HEAD with the size and no body", async () => {
    const response = await request(`/${PARQUET_FILE}`, { method: "HEAD" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe(String(SIZE));
    expect(await response.text()).toBe("");
  });

  it("returns 503 with the usual headers when storage fails", async () => {
    const response = await requestWith({ DATA: UNREADABLE_BUCKET }, `/${PARQUET_FILE}`, {
      headers: { Origin: PRODUCTION },
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("Vary")).toBe("Origin");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(PRODUCTION);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("returns 404 for a missing file", async () => {
    expect((await request(`/${VERSION}/2026/t1/resumo/xx.json`)).status).toBe(404);
    expect((await request(`/${VERSION}/2026/t1/resumo/xx.json`, { method: "HEAD" })).status).toBe(
      404,
    );
  });
});

describe("paths that are not files", () => {
  it.each([
    "/",
    "/v",
    "/v/",
    `/${VERSION}`,
    `/${VERSION}/`,
    `/${VERSION}/2026/t1/`,
    "/assets/duckdb-wasm/1.29.0",
    "/assets/duckdb-wasm/1.29.0/",
    "/assets/geo",
    "/assets/geo/",
    "/assets/geo/ibge-2025",
    "/assets/geo/ibge-2025/",
    `/${GEO_BUILD}/`,
  ])("returns 404 and no listing for %s", async (path) => {
    const response = await requestWith({ DATA: UNREADABLE_BUCKET }, path);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it.each([
    "/manifest.json",
    "/data/2026/t1/resumo/br.json",
    "/assets/other/1.0.0/file.wasm",
    "/assets/1.29.0/duckdb-eh.wasm",
    "/assets/geography/ibge-2025/20261010-abc1234-37000000000/br.json",
    "/assets/GEO/ibge-2025/20261010-abc1234-37000000000/br.json",
    "/assets/maps/ibge-2025/20261010-abc1234-37000000000/br.json",
    "/V/20261005-abc1234-17/manifest.json",
    "/vv/20261005-abc1234-17/manifest.json",
  ])("returns 404 without reading storage for %s, outside the allowed prefixes", async (path) => {
    expect((await requestWith({ DATA: UNREADABLE_BUCKET }, path)).status).toBe(404);
  });

  it("returns 404 without reading storage for a key longer than R2 allows", async () => {
    const path = `/${VERSION}/${"a".repeat(1024 - VERSION.length - "/.json".length + 1)}.json`;

    expect(path.length - 1).toBe(1025);
    expect((await requestWith({ DATA: UNREADABLE_BUCKET }, path)).status).toBe(404);
  });

  it("reads storage for a key of exactly R2's limit", async () => {
    const path = `/${VERSION}/${"a".repeat(1024 - VERSION.length - "/.json".length)}.json`;

    expect(path.length - 1).toBe(1024);
    expect((await request(path)).status).toBe(404);
  });

  it.each([
    `/${VERSION}/2026%2Ft1/resumo/br.json`,
    `/${VERSION}/2026%2ft1/resumo/br.json`,
    `/v%2F20261005-abc1234-17/2026/t1/resumo/br.json`,
  ])("returns 404 without reading storage for the encoded slash in %s", async (path) => {
    expect((await requestWith({ DATA: UNREADABLE_BUCKET }, path)).status).toBe(404);
  });

  it("returns 404 without reading storage when resolving dot-dot leaves the version", async () => {
    const response = await requestWith({ DATA: UNREADABLE_BUCKET }, `/${VERSION}/../../secret`);

    expect(response.status).toBe(404);
  });

  it("checks the resolved path when resolving dot-dot stays inside the version", async () => {
    const response = await request(`/${VERSION}/2026/../2026/t1/resumo/br.json`);

    expect(response.status).toBe(200);
    expect(await bytesOf(response)).toEqual(BYTES);
  });

  // A Request resolves `..` before the Worker sees it, so the raw form is tested on the parser.
  it.each([
    `https://worker.test/${VERSION}/../20261006-def5678-18/manifest.json`,
    `https://worker.test/${VERSION}/./manifest.json`,
    `https://worker.test/${VERSION}/%2e%2e/manifest.json`,
    `https://worker.test/${VERSION}//manifest.json`,
    `https://worker.test/${VERSION}/2026/t1/resumo/br.json%00`,
    `https://worker.test/${VERSION}/2026/t1/resumo/b r.json`,
  ])("rejects the raw URL %s", (url) => {
    expect(keyFromUrl(url)).toBeNull();
  });

  it("ignores the query string", () => {
    expect(keyFromUrl(`https://worker.test/${JSON_FILE}?cache=1#top`)).toBe(JSON_FILE);
  });
});

describe("methods", () => {
  it.each(["PUT", "POST", "DELETE", "PATCH"])(
    "returns 405 for %s and leaves storage unchanged",
    async (method) => {
      const body = method === "DELETE" ? undefined : "overwritten";

      const existing = await request(`/${PARQUET_FILE}`, { method, body });
      const created = await request(`/${VERSION}/new.json`, { method, body });

      expect(existing.status).toBe(405);
      expect(existing.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
      expect(created.status).toBe(405);
      const stored = await env.DATA.get(PARQUET_FILE);
      expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(BYTES);
      expect(await env.DATA.head(`${VERSION}/new.json`)).toBeNull();
    },
  );
});
