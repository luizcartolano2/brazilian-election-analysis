import { beforeEach, expect, it } from "vitest";
import {
  GEO_FILE,
  IMMUTABLE,
  JSON_FILE,
  PARQUET_FILE,
  request,
  seed,
  VERSION,
  WASM_FILE,
} from "./helpers";

beforeEach(seed);

it.each([
  ["a data file", `/${PARQUET_FILE}`, {}],
  ["a summary file", `/${JSON_FILE}`, {}],
  ["the WebAssembly asset", `/${WASM_FILE}`, {}],
  ["a boundary file", `/${GEO_FILE}`, {}],
  ["a range", `/${PARQUET_FILE}`, { headers: { Range: "bytes=0-9" } }],
  ["HEAD", `/${PARQUET_FILE}`, { method: "HEAD" }],
] as const)("marks %s immutable for a year", async (_, path, init) => {
  const response = await request(path, init);

  expect(response.ok).toBe(true);
  expect(response.headers.get("Cache-Control")).toBe(IMMUTABLE);
});

it.each([
  ["a missing file", `/${VERSION}/missing.json`, {}],
  ["a path outside a version", "/", {}],
  ["an unsatisfiable range", `/${PARQUET_FILE}`, { headers: { Range: "bytes=99999-" } }],
] as const)("does not cache %s", async (_, path, init) => {
  const response = await request(path, init);

  expect(response.ok).toBe(false);
  expect(response.headers.get("Cache-Control")).toBeNull();
});
