import { normalizePhotoUrl } from "@/lib/photos";
type WikipediaSummary = {
  type?: string;
  extract?: string;
  thumbnail?: { source: string };
  originalimage?: { source: string };
  coordinates?: { lat: number; lon: number };
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
  // Where the article's subject is, when it says.
  coordinates?: { latitude: number; longitude: number };
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
    // A list of same-named places says nothing about this one.
    if (result.type === "disambiguation" || !result.extract?.trim()) return null;

    return {
      description: result.extract.trim(),
      imageUrl: result.originalimage?.source ?? result.thumbnail?.source,
      ...(result.coordinates
        ? {
            coordinates: {
              latitude: result.coordinates.lat,
              longitude: result.coordinates.lon,
            },
          }
        : {}),
    };
  } catch {
    return null;
  }
}

// A protocol-relative Wikimedia thumbnail URL (//upload.wikimedia.org/…) with a
// small width baked into the path. Bump it to 960 — one of the few widths
// Wikimedia will still render (800 etc. now return HTTP 400).
function upscaleThumb(src: string): string {
  const absolute = src.startsWith("//") ? `https:${src}` : src;
  return normalizePhotoUrl(
    absolute.replace(/\/(\d+)px-/, (match, width) =>
      Number(width) < 960 ? "/960px-" : match,
    ),
  );
}

// Files that are diagrams rather than photos: icons, logos, flags, and —
// very common on small-place articles — location/relief maps, aerial/satellite
// imagery, and technical plans (castle layouts, cross-sections, blueprints).
const NON_PHOTO =
  /icon|logo|flag|locat|\bmap\b|_map|map_|地図|位置図?|地形|relief|topograph|globe|emblem|crest|seal|banner|chart|diagram|montage|aerial|satellite|orthophoto|birdseye|鳥瞰|俯瞰|航空写真|衛星|縄張|平面図|断面|図面|blueprint|sketch|schematic|国土地理院|openstreetmap|\bosm\b|\.svg|\.gif|\.pdf|\.tif/i;

// True when a file name / URL plausibly points at an actual photo.
export function looksLikePhoto(nameOrUrl: string): boolean {
  return !NON_PHOTO.test(nameOrUrl);
}

// Old and new forms of kanji that place names and file names mix freely
// (國坂神社 / 国坂神社).
const KANJI_VARIANTS: Record<string, string> = {
  國: "国", 舊: "旧", 濱: "浜", 澤: "沢", 嶋: "島", 嶌: "島", 邊: "辺", 邉: "辺",
  龍: "竜", 櫻: "桜", 廣: "広", 寳: "宝", 寶: "宝", 會: "会", 繪: "絵", 圓: "円",
  靈: "霊", 齋: "斎", 齊: "斉", 眞: "真", 德: "徳", 惠: "恵", 豐: "豊", 瀧: "滝",
  峯: "峰", 槇: "槙", 髙: "高", 﨑: "崎", 嵜: "崎", 藏: "蔵", 佛: "仏", 禪: "禅",
  縣: "県", 驛: "駅", 觀: "観", 臺: "台", 檜: "桧",
};

function normalizeName(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s　_・·\-–—'’"“”「」『』()（）[\]【】]/g, "")
    .replace(/./g, (char) => KANJI_VARIANTS[char] ?? char)
    .toLowerCase();
}

// Words that, alone, would match photos of any shrine, any onsen...
const GENERIC_PART =
  /^(神社|寺|寺院|温泉|公園|庭園|城|城跡|滝|山|湖|美術館|博物館|資料館|展望台|駅|道の駅|本殿|拝殿|本堂|旧|新)$/;

// What a photo's file name must contain to be about this place: the whole
// name, or one of its distinctive parts ("有馬温泉 金の湯" → 金の湯).
export function placeNameKeys(name: string): string[] {
  const bare = name.replace(/\s*[(（][^()（）]*[)）]$/, "");
  const keys = new Set([normalizeName(bare)]);
  for (const part of bare.split(/[\s　・]+/)) {
    const key = normalizeName(part);
    if (key.length >= 3 && !GENERIC_PART.test(part)) keys.add(key);
  }
  return [...keys].filter((key) => key.length >= 2);
}

// File names and URLs, percent-encoded or not.
function readable(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function titleMatchesPlace(title: string, keys: string[]): boolean {
  if (!keys.length) return true;
  const text = normalizeName(readable(title));
  return keys.some((key) => text.includes(key));
}

// For photos found only by location: words that show the file is of the
// kind of place we're sending someone to, and ones that show it isn't
// (roads, junctions, stations, traffic...).
const GENRE_WORDS: Record<string, RegExp> = {
  shrine: /神社|神宮|大社|寺|院|鳥居|社殿|本殿|拝殿|本堂|境内|山門|五重塔|三重塔|shrine|jinja|jingu|temple|torii|pagoda|-ji\b|-in\b/i,
  history: /城|遺跡|古墳|史跡|石垣|天守|castle|ruins?\b|tumulus|kofun|historic/i,
  nature: /滝|渓谷|峡|湖|池|森|林|海岸|浜|岬|公園|庭園|花|桜|紅葉|高原|falls|waterfall|gorge|valley|lake|pond|forest|beach|coast|cape|park|garden|blossom|autumn/i,
  viewpoint: /展望|夜景|眺望|眺め|山頂|灯台|タワー|view|observatory|lookout|tower|lighthouse|panorama|summit/i,
  museum: /美術館|博物館|資料館|記念館|museum|gallery/i,
  "hot-spring": /温泉|湯|onsen|hot ?spring|spa|足湯/i,
  food: /酒|蔵|醸造|市場|食|料理|道の駅|brewery|sake|winery|market|michi-no-eki|food/i,
};
const OFF_TOPIC =
  /国道|県道|府道|道道|市道|道路|交差点|踏切|線路|高速|IC\b|インター|バス|信号|標識|看板|駐車場|road|route|street|avenue|intersection|crossing|junction|interchange|expressway|highway|railway|bus|truck|traffic|signal|parking|sign\b/i;

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
  // When given, only files whose name mentions the place (Commons' text
  // search also matches descriptions that merely mention the prefecture).
  placeName?: string,
): Promise<string[]> {
  const keys = placeName ? placeNameKeys(placeName) : [];
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php" +
      `?action=query&format=json&origin=*` +
      `&generator=search&gsrsearch=${encodeURIComponent(query)}` +
      `&gsrnamespace=6&gsrlimit=20` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=960`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as {
      query?: { pages?: Record<string, GeoSearchPage> };
    };
    const urls: string[] = [];
    for (const page of Object.values(data.query?.pages ?? {})) {
      const title = page.title ?? "";
      if (!/\.(jpe?g|png|webp)$/i.test(title) || !looksLikePhoto(title)) continue;
      if (!titleMatchesPlace(title, keys)) continue;
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
      out.push(normalizePhotoUrl(url));
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

// Last-resort photo source: pictures taken right by the place, via the
// Wikimedia Commons geosearch API (no key, CORS-enabled). Only ones named
// after the place, or clearly of its kind (a torii by a shrine) and not of
// the road outside it.
export async function getNearbyPhotos(
  latitude: number,
  longitude: number,
  place: { name: string; categories: string[] },
  limit = 6,
): Promise<string[]> {
  const keys = placeNameKeys(place.name);
  const kinds = place.categories.map((category) => GENRE_WORDS[category]).filter(Boolean);
  const relevant = (title: string) =>
    titleMatchesPlace(title, keys) ||
    (!OFF_TOPIC.test(title) && kinds.some((words) => words.test(title)));
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php" +
      `?action=query&format=json&origin=*` +
      `&generator=geosearch&ggscoord=${latitude}%7C${longitude}` +
      `&ggsradius=600&ggslimit=30&ggsnamespace=6` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=960`;
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
      if (!looksLikePhoto(title) || !relevant(title)) continue;
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
