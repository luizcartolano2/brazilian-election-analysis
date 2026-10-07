const SEGMENT = /^[A-Za-z0-9_.=-]+$/;

// R2 throws on a longer key instead of returning nothing, which would turn a 404 into a 500.
const MAX_KEY_LENGTH = 1024;

// Each prefix is followed by a version segment and at least one file segment.
const PREFIXES = [["v"], ["assets", "duckdb-wasm"]];

/**
 * Maps a request URL to a storage key, or null when its path is outside a version. It reads
 * the path as sent, because `new URL()` resolves `..` segments and decoding turns `%2F` into
 * a slash.
 */
export function keyFromUrl(url: string): string | null {
  const pathStart = url.indexOf("/", url.indexOf("://") + 3);
  if (pathStart === -1) return null;
  const path = url.slice(pathStart).split(/[?#]/, 1)[0] ?? "";
  if (path.length - 1 > MAX_KEY_LENGTH) return null;
  const segments = path.slice(1).split("/");
  const safe = segments.every(
    (segment) => SEGMENT.test(segment) && segment !== "." && segment !== "..",
  );
  if (!safe) return null;
  const inVersion = PREFIXES.some(
    (prefix) =>
      segments.length >= prefix.length + 2 &&
      prefix.every((part, index) => segments[index] === part),
  );
  return inVersion ? segments.join("/") : null;
}
