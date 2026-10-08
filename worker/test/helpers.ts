import { env, exports } from "cloudflare:workers";
import worker, { type Env } from "../src/index";

export const VERSION = "v/20261005-abc1234-17";
export const PARQUET_FILE = `${VERSION}/2026/t1/votos/cargo=3/uf=AC.parquet`;
export const JSON_FILE = `${VERSION}/2026/t1/resumo/br.json`;
export const WASM_FILE = "assets/duckdb-wasm/1.29.0/duckdb-eh.wasm";
export const GEO_BUILD = "assets/geo/ibge-2025/20261010-abc1234-37000000000";
export const GEO_FILE = `${GEO_BUILD}/br.json`;
export const SIZE = 4096;
export const BYTES = Uint8Array.from({ length: SIZE }, (_, index) => index % 251);

export const PRODUCTION = "https://eleicoes.luizcartolano.com";
export const IMMUTABLE = "public, max-age=31536000, immutable";

export async function seed(): Promise<void> {
  await Promise.all(
    [PARQUET_FILE, JSON_FILE, WASM_FILE, GEO_FILE].map((key) => env.DATA.put(key, BYTES)),
  );
}

/** Goes through the Worker's fetch entry point with the environment from `wrangler.jsonc`. */
export function request(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(`https://worker.test${path}`, init);
}

/** Calls the handler with an environment that `wrangler.jsonc` does not give. */
export function requestWith(
  overrides: Partial<Env>,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return worker.fetch(new Request(`https://worker.test${path}`, init), { ...env, ...overrides });
}

export const UNREADABLE_BUCKET = new Proxy({} as R2Bucket, {
  get() {
    throw new Error("the Worker read storage");
  },
});

/** The local bucket, recording the name of each method the Worker calls on it. */
export function countingBucket(): { bucket: R2Bucket; calls: string[] } {
  const calls: string[] = [];
  const bucket = new Proxy(env.DATA, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if (typeof value !== "function") return value;
      calls.push(String(property));
      return value.bind(target);
    },
  });
  return { bucket, calls };
}

export async function bytesOf(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}
