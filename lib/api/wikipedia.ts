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
      // Drop vector icons/logos/flags that clutter articles.
      if (/\.svg/i.test(title)) continue;
      if (/icon|logo|commons-logo|flag|map|locator/i.test(title)) continue;

      const best = item.srcset?.[0]?.src;
      if (!best) continue;
      const url = upscaleThumb(best);
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= limit) break;
    }

    return urls;
  } catch {
    return [];
  }
}
