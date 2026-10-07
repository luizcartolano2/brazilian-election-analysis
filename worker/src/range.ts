export interface ByteRange {
  offset: number;
  length: number;
}

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/i;

/**
 * Reads a `Range` header against a file's size. A header with several ranges or bad syntax
 * is ignored, which RFC 9110 allows, so the caller sends the whole file.
 */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | "whole" | "unsatisfiable" {
  const match = header === null ? null : SINGLE_RANGE.exec(header);
  if (match === null) return "whole";
  const [, first, last] = match;
  if (first === "" && last === "") return "whole";

  if (first === "") {
    const suffix = Number(last);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }

  const start = Number(first);
  if (last !== "" && Number(last) < start) return "whole";
  if (start >= size) return "unsatisfiable";
  const end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  return { offset: start, length: end - start + 1 };
}
