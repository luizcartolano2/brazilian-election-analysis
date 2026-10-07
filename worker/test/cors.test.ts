import { beforeEach, describe, expect, it } from "vitest";
import { allowsOrigin } from "../src/cors";
import { JSON_FILE, PARQUET_FILE, PRODUCTION, request, requestWith, seed, VERSION } from "./helpers";

beforeEach(seed);

const TEAM = "luiz-team";
const PREVIEW = `https://eleicoes-a1b2c3d4e-${TEAM}.vercel.app`;
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

  it("allows a commit preview of this project under the team scope", async () => {
    const response = await requestWith(
      { VERCEL_TEAM_SLUG: TEAM },
      `/${PARQUET_FILE}`,
      withOrigin(PREVIEW),
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(PREVIEW);
  });

  it("allows no preview while the team slug is empty", async () => {
    const response = await request(`/${PARQUET_FILE}`, withOrigin(PREVIEW));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(allowsOrigin("https://eleicoes-a1b2c3d4e-.vercel.app", "")).toBe(false);
  });
});

describe("refused origins", () => {
  it.each([
    // Another team whose slug ends in this one, which a looser pattern would accept.
    `https://eleicoes-a1b2c3d4e-evil-${TEAM}.vercel.app`,
    // A branch preview of a project named eleicoes, on branch "luiz", in a team named "team".
    "https://eleicoes-git-luiz-team.vercel.app",
    `https://eleicoes-git-main-${TEAM}.vercel.app`,
    `https://eleicoes-a1b2c3d4-${TEAM}.vercel.app`,
    `https://eleicoes-a1b2c3d4e5-${TEAM}.vercel.app`,
    `https://eleicoes-A1B2C3D4E-${TEAM}.vercel.app`,
    `https://eleicoesx-a1b2c3d4e-${TEAM}.vercel.app`,
    `https://other-a1b2c3d4e-${TEAM}.vercel.app`,
    `http://eleicoes-a1b2c3d4e-${TEAM}.vercel.app`,
    `${PREVIEW}.evil.com`,
  ])("refuses the look-alike preview %s", async (origin) => {
    const response = await requestWith(
      { VERCEL_TEAM_SLUG: TEAM },
      `/${PARQUET_FILE}`,
      withOrigin(origin),
    );

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
    "http://localhost:3001",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
  ])("refuses the foreign origin %s", async (origin) => {
    const response = await request(`/${PARQUET_FILE}`, withOrigin(origin));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("refuses a team slug that is not a slug", () => {
    expect(allowsOrigin("https://eleicoes-a1b2c3d4e-.*.vercel.app", ".*")).toBe(false);
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
