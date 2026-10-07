import { beforeEach, describe, expect, it } from "vitest";
import { JSON_FILE, PARQUET_FILE, PRODUCTION, request, seed, VERSION } from "./helpers";

beforeEach(seed);

const EXPOSED = "Content-Range, Content-Length, Accept-Ranges, ETag";

function withOrigin(origin: string, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, Origin: origin } };
}

describe("allowed origins", () => {
  it("allows the production app and exposes the range headers", async () => {
    const response = await request(`/${PARQUET_FILE}`, withOrigin(PRODUCTION));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(PRODUCTION);
    expect(response.headers.get("Access-Control-Expose-Headers")).toBe(EXPOSED);
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("allows local development", async () => {
    const response = await request(`/${PARQUET_FILE}`, withOrigin("http://localhost:3000"));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
  });
});

describe("refused origins", () => {
  // Anyone can claim a free *.vercel.app alias, so no Vercel origin passes, this project's
  // previews included.
  it.each([
    "https://eleicoes-a1b2c3d4e-luizcartolano2s-projects.vercel.app",
    "https://eleicoes-git-main-luizcartolano2s-projects.vercel.app",
    "https://eleicoes-luizcartolano2s-projects.vercel.app",
    "https://eleicoes.vercel.app",
  ])("refuses the Vercel origin %s", async (origin) => {
    const response = await request(`/${PARQUET_FILE}`, withOrigin(origin));

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Expose-Headers")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it.each([
    "https://example.com",
    "null",
    "http://eleicoes.luizcartolano.com",
    "https://eleicoes.luizcartolano.com.evil.com",
    "https://www.eleicoes.luizcartolano.com",
    "https://eleicoes.luizcartolano.com/",
    "https://ELEICOES.luizcartolano.com",
    "http://localhost:3001",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
  ])("refuses the foreign origin %s", async (origin) => {
    const response = await request(`/${PARQUET_FILE}`, withOrigin(origin));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("preflight", () => {
  const preflight = {
    method: "OPTIONS",
    headers: { "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "range" },
  };

  it("allows GET and HEAD with a Range header for an allowed origin", async () => {
    const response = await request(`/${PARQUET_FILE}`, withOrigin(PRODUCTION, preflight));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(PRODUCTION);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Range");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("allows nothing for a foreign origin", async () => {
    const response = await request(`/${PARQUET_FILE}`, withOrigin("https://example.com", preflight));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
  });

  it("returns 404 for a path outside a version", async () => {
    const response = await request("/manifest.json", withOrigin(PRODUCTION, preflight));

    expect(response.status).toBe(404);
  });
});

describe("Vary: Origin", () => {
  it.each([
    ["200", `/${JSON_FILE}`, {}],
    ["206", `/${JSON_FILE}`, { headers: { Range: "bytes=0-9" } }],
    ["416", `/${JSON_FILE}`, { headers: { Range: "bytes=99999-" } }],
    ["HEAD", `/${JSON_FILE}`, { method: "HEAD" }],
    ["404", `/${VERSION}/missing.json`, {}],
    ["404 outside a version", "/", {}],
    ["405", `/${JSON_FILE}`, { method: "PUT", body: "x" }],
    ["preflight", `/${JSON_FILE}`, { method: "OPTIONS" }],
  ] as const)("is on the %s response, with and without an origin", async (_, path, init) => {
    const withoutOrigin = await request(path, init);
    const withAllowedOrigin = await request(path, withOrigin(PRODUCTION, init));

    expect(withoutOrigin.headers.get("Vary")).toBe("Origin");
    expect(withAllowedOrigin.headers.get("Vary")).toBe("Origin");
    expect(withAllowedOrigin.headers.get("Access-Control-Allow-Origin")).toBe(PRODUCTION);
  });
});
