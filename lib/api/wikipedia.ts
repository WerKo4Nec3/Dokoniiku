type WikipediaSummary = {
  extract?: string;
  thumbnail?: { source: string };
  originalimage?: { source: string };
};

type MediaListItem = {
  type?: string;
  title?: string;
  showInGallery?: boolean;
  srcset?: { src: string; scale?: string }[];
};

export type DestinationSummary = {
  description: string;
  imageUrl?: string;
};

export async function getDestinationSummary(
  name: string,
): Promise<DestinationSummary | null> {
  try {
    const response = await fetch(
      `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
    );
    if (!response.ok) return null;

    const result = (await response.json()) as WikipediaSummary;
    if (!result.extract?.trim()) return null;

    return {
      description: result.extract.trim(),
      imageUrl: result.originalimage?.source ?? result.thumbnail?.source,
    };
  } catch {
    return null;
  }
}

// A protocol-relative Wikimedia thumbnail URL (//upload.wikimedia.org/…) with a
// small width baked into the path. Bump it up so gallery images stay crisp.
function upscaleThumb(src: string): string {
  const absolute = src.startsWith("//") ? `https:${src}` : src;
  return absolute.replace(/\/(\d+)px-/, (match, width) =>
    Number(width) < 800 ? "/800px-" : match,
  );
}

// Files that are diagrams rather than photos: icons, logos, flags, and —
// very common on small-place articles — location/relief maps.
const NON_PHOTO =
  /icon|logo|flag|locat|\bmap\b|_map|map_|地図|位置|地形|relief|topograph|globe|emblem|crest|seal|banner|chart|diagram|montage|\.svg|\.gif|\.pdf|\.tif/i;

// True when a file name / URL plausibly points at an actual photo.
export function looksLikePhoto(nameOrUrl: string): boolean {
  return !NON_PHOTO.test(nameOrUrl);
}

// Photos on the place's Wikipedia article, pulled from Wikimedia Commons via
// the REST media-list endpoint. Icons, maps and non-photo files are skipped.
export async function getDestinationImages(
  name: string,
  limit = 6,
): Promise<string[]> {
  try {
    const response = await fetch(
      `https://ja.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(name)}`,
    );
    if (!response.ok) return [];

    const result = (await response.json()) as { items?: MediaListItem[] };
    const urls: string[] = [];
    const seen = new Set<string>();

    for (const item of result.items ?? []) {
      if (item.type !== "image" || !item.showInGallery) continue;
      const title = item.title ?? "";
      if (!looksLikePhoto(title)) continue;

      const best = item.srcset?.[0]?.src;
      if (!best) continue;
      const url = upscaleThumb(best);
      if (seen.has(url) || !looksLikePhoto(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= limit) break;
    }

    return urls;
  } catch {
    return [];
  }
}

type GeoSearchPage = {
  title?: string;
  imageinfo?: { thumburl?: string }[];
};

// Additional Wikimedia photos: full-text search of the Commons File namespace
// by place name — broader than a single article's media-list.
export async function searchCommonsPhotos(
  query: string,
  limit = 6,
): Promise<string[]> {
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php" +
      `?action=query&format=json&origin=*` +
      `&generator=search&gsrsearch=${encodeURIComponent(query)}` +
      `&gsrnamespace=6&gsrlimit=20` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=800`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as {
      query?: { pages?: Record<string, GeoSearchPage> };
    };
    const urls: string[] = [];
    for (const page of Object.values(data.query?.pages ?? {})) {
      const title = page.title ?? "";
      if (!/\.(jpe?g|png|webp)$/i.test(title) || !looksLikePhoto(title)) continue;
      const thumb = page.imageinfo?.[0]?.thumburl;
      if (thumb && !urls.includes(thumb)) urls.push(thumb);
      if (urls.length >= limit) break;
    }
    return urls;
  } catch {
    return [];
  }
}

// Normalise a Wikimedia/Openverse URL so the same image at different sizes or
// query strings dedupes to a single key.
function photoKey(url: string): string {
  return url
    .replace(/^https?:/, "")
    .replace(/\/\d+px-/, "/")
    .replace(/\?.*$/, "")
    .toLowerCase();
}

// Merge ordered photo groups: earlier groups win, dedupe by normalised key,
// keep only plausible photos, cap the total.
export function mergePhotos(groups: string[][], limit = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const url of group) {
      if (!url || !looksLikePhoto(url)) continue;
      const key = photoKey(url);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(url);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// Several short "豆知識" facts, keyless: the full lead-section plaintext from the
// Action API, split into sentences. Broader than the REST summary.
export async function getDestinationFacts(
  name: string,
  max = 5,
): Promise<string[]> {
  try {
    const url =
      "https://ja.wikipedia.org/w/api.php" +
      `?action=query&format=json&origin=*&redirects=1` +
      `&prop=extracts&explaintext=1&exintro=1&exsectionformat=plain` +
      `&titles=${encodeURIComponent(name)}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as {
      query?: { pages?: Record<string, { extract?: string }> };
    };
    const extract = Object.values(data.query?.pages ?? {})[0]?.extract ?? "";
    return extract
      .replace(/\n+/g, " ")
      .split(/(?<=。)/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 12 && s.length <= 140 && s.endsWith("。"))
      .filter((s) => !/^[ぁ-んー、・（）\s]+。$/.test(s))
      .slice(0, max);
  } catch {
    return [];
  }
}

// Last-resort photo source: pictures taken near the place's coordinates,
// via the Wikimedia Commons geosearch API (no key, CORS-enabled).
export async function getNearbyPhotos(
  latitude: number,
  longitude: number,
  limit = 6,
): Promise<string[]> {
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php" +
      `?action=query&format=json&origin=*` +
      `&generator=geosearch&ggscoord=${latitude}%7C${longitude}` +
      `&ggsradius=1500&ggslimit=20&ggsnamespace=6` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=800`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = (await response.json()) as {
      query?: { pages?: Record<string, GeoSearchPage> };
    };
    const pages = Object.values(data.query?.pages ?? {});
    const urls: string[] = [];
    for (const page of pages) {
      const title = page.title ?? "";
      if (!/\.(jpe?g|png|webp)$/i.test(title)) continue;
      if (!looksLikePhoto(title)) continue;
      const thumb = page.imageinfo?.[0]?.thumburl;
      if (!thumb || urls.includes(thumb)) continue;
      urls.push(thumb);
      if (urls.length >= limit) break;
    }
    return urls;
  } catch {
    return [];
  }
}
