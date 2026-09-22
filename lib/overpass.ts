// Server-side Overpass (OpenStreetMap) client. Public mirrors are slow and
// rate-limited, so requests are "hedged": the primary starts at once and the
// fallbacks join if it hasn't answered yet; the first valid answer wins. Every
// attempt has its own timeout; the API routes cache successful answers at the
// CDN for a day.

export type OverpassTags = Record<string, string>;
export type OverpassElement = {
  type: "node" | "way" | "relation";
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OverpassTags;
};

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const USER_AGENT = "Dokoniiku/1.0 (weekend trip picker; +https://dokoniiku.com)";
const HEDGE_DELAY_MS = 2500;
const ATTEMPT_TIMEOUT_MS = 9000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attempt(
  mirror: string,
  query: string,
  delayMs: number,
): Promise<OverpassElement[]> {
  if (delayMs) await sleep(delayMs);
  const response = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
    // Mirrors reject anonymous clients (406/429) — identify ourselves.
    headers: { "User-Agent": USER_AGENT, Referer: "https://dokoniiku.com/" },
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    // Caching happens at the route level (CDN, success-only), never here, so
    // a mirror error can't get pinned.
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`overpass ${response.status}`);
  const json = (await response.json()) as { elements?: OverpassElement[] };
  if (!Array.isArray(json.elements)) throw new Error("overpass: no elements");
  return json.elements;
}

export async function overpassQuery(query: string): Promise<OverpassElement[]> {
  try {
    return await Promise.any(
      MIRRORS.map((mirror, i) => attempt(mirror, query, i * HEDGE_DELAY_MS)),
    );
  } catch {
    return [];
  }
}

export function distanceM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function elementCoords(el: OverpassElement): { lat: number; lon: number } | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  return lat == null || lon == null ? null : { lat, lon };
}
