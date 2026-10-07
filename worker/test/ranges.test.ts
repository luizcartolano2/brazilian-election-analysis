import { beforeEach, describe, expect, it } from "vitest";
import { parseRangeHeader, resolveRange } from "../src/range";
import {
  BYTES,
  bytesOf,
  countingBucket,
  PARQUET_FILE,
  request,
  requestWith,
  seed,
  SIZE,
} from "./helpers";

beforeEach(seed);

function getRange(range: string): Promise<Response> {
  return request(`/${PARQUET_FILE}`, { headers: { Range: range } });
}

describe("a single range", () => {
  it.each([
    ["bytes=0-99", 0, 99],
    ["bytes=1000-1999", 1000, 1999],
    ["bytes=4000-9999", 4000, SIZE - 1],
    ["bytes=4095-4095", 4095, 4095],
    ["bytes=3000-", 3000, SIZE - 1],
    ["bytes=-1024", SIZE - 1024, SIZE - 1],
    ["bytes=-9999", 0, SIZE - 1],
    ["BYTES=0-0", 0, 0],
  ])("returns %s as bytes %i to %i", async (range, first, last) => {
    const response = await getRange(range);

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe(`bytes ${first}-${last}/${SIZE}`);
    expect(response.headers.get("Content-Length")).toBe(String(last - first + 1));
    expect(await bytesOf(response)).toEqual(BYTES.slice(first, last + 1));
  });
});

describe("a range that cannot be served", () => {
  it.each(["bytes=4096-", "bytes=4096-5000", "bytes=99999-", "bytes=-0"])(
    "returns 416 for %s",
    async (range) => {
      const response = await getRange(range);

      expect(response.status).toBe(416);
      expect(response.headers.get("Content-Range")).toBe(`bytes */${SIZE}`);
    },
  );
});

describe("a header the Worker ignores", () => {
  it.each([
    "bytes=0-1,5-6",
    "bytes=0-99, 200-299",
    "bytes=-",
    "bytes=99-0",
    "bytes=abc",
    "bytes= 0-99",
    "items=0-99",
    "0-99",
    "",
  ])("returns the whole file with 200 for %j", async (range) => {
    const response = await getRange(range);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Range")).toBeNull();
    expect(response.headers.get("Content-Length")).toBe(String(SIZE));
    expect(await bytesOf(response)).toEqual(BYTES);
  });

  it("ignores a range on HEAD", async () => {
    const response = await request(`/${PARQUET_FILE}`, {
      method: "HEAD",
      headers: { Range: "bytes=0-99" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe(String(SIZE));
  });

  it("returns 404 for a range on a missing file", async () => {
    const response = await request(`/${PARQUET_FILE}.missing`, {
      headers: { Range: "bytes=0-99" },
    });

    expect(response.status).toBe(404);
  });
});

describe("R2 reads", () => {
  it.each([
    ["no Range header", undefined, ["get"]],
    ["a single range", "bytes=0-9", ["head", "get"]],
    ["several ranges", "bytes=0-1,5-6", ["get"]],
    ["a malformed header", "items=0-9", ["get"]],
  ])("reads the size first only for a range it will serve: %s", async (_, range, expected) => {
    const { bucket, calls } = countingBucket();
    const headers: Record<string, string> = range === undefined ? {} : { Range: range };

    const response = await requestWith({ DATA: bucket }, `/${PARQUET_FILE}`, { headers });

    expect(response.ok).toBe(true);
    expect(calls).toEqual(expected);
  });
});

describe("parseRangeHeader and resolveRange", () => {
  it("has no satisfiable range in an empty file", () => {
    expect(resolveRange({ first: 0, last: null }, 0)).toBe("unsatisfiable");
    expect(resolveRange({ first: null, last: 10 }, 0)).toBe("unsatisfiable");
  });

  it("clamps an end past the file", () => {
    const spec = parseRangeHeader("bytes=5-99999999999999999999");

    expect(spec).not.toBeNull();
    expect(resolveRange(spec!, 10)).toEqual({ offset: 5, length: 5 });
  });
});
