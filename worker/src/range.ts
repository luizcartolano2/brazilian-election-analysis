export interface ByteRange {
  offset: number;
  length: number;
}

/** A single range as written: `first` is null for a suffix range, `last` for an open end. */
export interface RangeSpec {
  first: number | null;
  last: number | null;
}

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/i;

/**
 * Reads the syntax of a `Range` header. Returns null for a header to ignore, with several
 * ranges or bad syntax, which RFC 9110 allows, so the caller sends the whole file without
 * reading its size first.
 */
export function parseRangeHeader(header: string): RangeSpec | null {
  const match = SINGLE_RANGE.exec(header);
  if (match === null) return null;
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") return null;
  const spec = { first: first === "" ? null : Number(first), last: last === "" ? null : Number(last) };
  if (spec.first !== null && spec.last !== null && spec.last < spec.first) return null;
  return spec;
}

export function resolveRange(spec: RangeSpec, size: number): ByteRange | "unsatisfiable" {
  if (spec.first === null) {
    const suffix = spec.last ?? 0;
    if (suffix === 0 || size === 0) return "unsatisfiable";
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }
  if (spec.first >= size) return "unsatisfiable";
  const end = spec.last === null ? size - 1 : Math.min(spec.last, size - 1);
  return { offset: spec.first, length: end - spec.first + 1 };
}
