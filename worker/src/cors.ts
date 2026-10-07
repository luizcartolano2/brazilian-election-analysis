// Vercel previews are left out on purpose. Anyone can claim a free `*.vercel.app` alias, so
// no pattern can tell this project's previews from a look-alike.
const ALLOWED_ORIGINS = new Set(["https://eleicoes.luizcartolano.com", "http://localhost:3000"]);

export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, ETag",
  };
}

// Every preflight counts against the free daily quota, so browsers keep the answer a day.
export const PREFLIGHT_HEADERS = {
  "Access-Control-Allow-Methods": "GET, HEAD",
  "Access-Control-Allow-Headers": "Range",
  "Access-Control-Max-Age": "86400",
};
