// Keyless CC-licensed image search (api.openverse.org). CORS-enabled, so we
// call it directly from the client like the Wikipedia helpers, with a small
// module cache to avoid repeat lookups for the same place. Anonymous limits are
// 20/min & 200/day; the merge tolerates an empty result past the cap.
import { looksLikePhoto } from "./wikipedia";

const cache = new Map<string, string[]>();

export async function getOpenversePhotos(
  query: string,
  limit = 6,
): Promise<string[]> {
  const cacheKey = `${query}:${limit}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  try {
    const url =
      "https://api.openverse.org/v1/images/" +
      `?q=${encodeURIComponent(query)}` +
      `&page_size=${Math.min(limit * 2, 20)}` +
      `&license_type=commercial&mature=false`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: { url?: string; title?: string }[];
    };
    const urls: string[] = [];
    const seen = new Set<string>();
    for (const r of data.results ?? []) {
      const u = r.url;
      if (!u || !/^https?:\/\//i.test(u)) continue;
      if (!/\.(jpe?g|png|webp)(\?|$)/i.test(u)) continue;
      if (!looksLikePhoto(`${r.title ?? ""} ${u}`)) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      urls.push(u);
      if (urls.length >= limit) break;
    }
    cache.set(cacheKey, urls);
    return urls;
  } catch {
    return [];
  }
}
