const PRODUCTION_ORIGIN = "https://eleicoes.luizcartolano.com";
const LOCAL_ORIGIN = "http://localhost:3000";
const PREVIEW_PREFIX = "https://eleicoes-";
const TEAM_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEPLOYMENT_HASH = /^[a-z0-9]{9}$/;

/**
 * Vercel names a commit preview `<project>-<9-character hash>-<scope>.vercel.app`. Only that
 * form passes. A looser pattern, or a branch preview, also matches another team whose slug
 * ends in this one.
 */
export function allowsOrigin(origin: string, teamSlug: string): boolean {
  if (origin === PRODUCTION_ORIGIN || origin === LOCAL_ORIGIN) return true;
  if (!TEAM_SLUG.test(teamSlug)) return false;
  const suffix = `-${teamSlug}.vercel.app`;
  if (!origin.startsWith(PREVIEW_PREFIX) || !origin.endsWith(suffix)) return false;
  return DEPLOYMENT_HASH.test(origin.slice(PREVIEW_PREFIX.length, origin.length - suffix.length));
}

export function corsHeaders(origin: string | null, teamSlug: string): Record<string, string> {
  if (origin === null || !allowsOrigin(origin, teamSlug)) return {};
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
