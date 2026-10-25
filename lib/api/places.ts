import {
  genericFallbacks,
  mockDestinations,
} from "@/data/mockDestinations";
import type {
  Destination,
  DestinationCategory,
  Prefecture,
  SearchProviderResult,
} from "@/types";
import { displayPlaceName, preciseDistanceKm, randomItem } from "@/lib/utils/travel";

const WIKI_ENDPOINT = "https://ja.wikipedia.org/w/api.php";

type WikipediaGeoSearchItem = {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
};

type WikipediaGeoSearchResponse = {
  query?: { geosearch?: WikipediaGeoSearchItem[] };
};

// Wikipedia's geosearch returns every nearby article (offices, hospitals,
// stations, companies...). These patterns keep only article titles that
// look like an actual sightseeing spot, and drop obvious non-attractions.
const attractionPattern =
  /城|神社|寺|庭園|公園|温泉|美術館|博物館|資料館|記念館|遺跡|古墳|滝|渓谷|岬|展望|タワー|灯台|神宮|大社|海岸|湖|橋|城跡|史跡|名所|遊園地|動物園|水族館|宮|院/;
const nonAttractionPattern =
  /病院|大学|高校|高等学校|中等教育学校|中学校|小学校|学校|消防|市役所|区役所|警察|放送|テレビ|新聞|銀行|会社|店舗|モール|工場|発電所|気象台|農政局|市場|専門学校|学院|協会|局|本社|スタジアム|球場|停留場|バス停|ホール|劇場|ホテル|センター|駅$|町$|町・|村$|村 \(/;

// Administrative areas / lists that slip into category searches but are not
// a concrete place to visit (whole cities, towns, villages, regions...).
const adminAreaPattern = /(村|町|市|区|郡|地方|半島|平野|盆地|都道府県)$|一覧|の観光$|文化$/;

// Wikipedia organises places into per-prefecture categories such as
// "奈良県の温泉" or "京都府の城". Each genre maps to a few of these; a word
// with no such category in some prefecture just matches nothing there.
// (All words together must stay under 50: the clcategories limit.)
const categoryWikiWords: Record<DestinationCategory, string[]> = {
  nature: [
    "自然公園", "公園", "山", "峠", "島", "滝", "渓谷", "湖", "高原", "海岸",
    "自然景勝地", "地形",
  ],
  history: [
    "城", "史跡", "古墳", "遺跡", "考古遺跡", "重要文化財", "国宝", "登録有形文化財", "民家",
  ],
  shrine: ["神社", "寺", "旧県社", "旧府社", "旧郷社", "旧村社"],
  museum: ["博物館", "美術館", "資料館", "科学館"],
  "hot-spring": ["温泉"],
  food: ["道の駅", "酒蔵", "日本酒メーカー", "酒"],
  viewpoint: ["展望台", "タワー", "灯台", "ダム", "山", "峠", "自然景勝地"],
};

// Categories whose subcategories (by city, e.g. "京都市の寺院") hold many
// more places than the prefecture-level category itself; searched with
// `deepcat`, which takes one category per query.
const deepWikiRoots: Record<DestinationCategory, string[]> = {
  nature: ["自然景勝地", "公園"],
  history: ["城", "古墳", "考古遺跡"],
  shrine: ["神社", "寺"],
  museum: ["博物館", "美術館"],
  "hot-spring": ["温泉"],
  food: ["道の駅", "日本酒メーカー"],
  viewpoint: ["自然景勝地", "山"],
};

const allGenres = Object.keys(categoryWikiWords) as DestinationCategory[];

// Live results per prefecture + genre (+ reach), so re-rolls don't refetch;
// in-flight searches are shared so a prefetch and a click don't double up.
const resultCache = new Map<string, Destination[]>();
const inFlight = new Map<string, Promise<SearchProviderResult<Destination[]>>>();

function cacheKey(
  prefecture: Prefecture,
  categories: DestinationCategory[],
  near?: NearFilter,
) {
  const area = near
    ? `|${near.latitude.toFixed(3)},${near.longitude.toFixed(3)},${Math.ceil(near.radiusKm)}`
    : "";
  return `${prefecture.id}|${[...categories].sort().join(",")}${area}`;
}

function isLikelyAttraction(title: string): boolean {
  return attractionPattern.test(title) && !nonAttractionPattern.test(title);
}

function mapCategoryFromTitle(title: string): DestinationCategory[] {
  const result: DestinationCategory[] = [];
  if (/公園|庭園|山|渓谷|滝|湖|海岸|岬|高原/.test(title)) result.push("nature");
  if (/城|城跡|遺跡|古墳|史跡|藩/.test(title)) result.push("history");
  if (/神社|神宮|大社|寺|院|宮/.test(title)) result.push("shrine");
  if (/美術館|博物館|資料館|記念館/.test(title)) result.push("museum");
  if (/温泉/.test(title)) result.push("hot-spring");
  if (/市場|名物|グルメ/.test(title)) result.push("food");
  if (/展望|タワー|灯台|橋/.test(title)) result.push("viewpoint");
  return result.length ? result.slice(0, 3) : ["history"];
}

function getFallback(prefecture: Prefecture): Destination {
  const matching = mockDestinations.filter(
    (destination) => destination.prefectureId === prefecture.id,
  );
  if (matching.length) return randomItem(matching);

  const fallback = genericFallbacks[prefecture.id];
  if (fallback) return { ...fallback, prefectureId: prefecture.id };

  return {
    id: `${prefecture.id}-center`,
    name: `${prefecture.nameJa} まち歩き`,
    prefectureId: prefecture.id,
    latitude: prefecture.latitude,
    longitude: prefecture.longitude,
    categories: ["history", "food"],
    description: `${prefecture.shortDescriptionJa} まずは中心エリアから、気になる道へ歩いてみよう。`,
  };
}

function buildDescription(prefecture: Prefecture): string {
  return `${prefecture.nameJa}で見つけた、気ままな週末旅にちょうどいいスポットです。`;
}

// Places within this distance of a point only (CirrusSearch `nearcoord`).
export type NearFilter = { latitude: number; longitude: number; radiusKm: number };

type WikiQueryResponse = {
  batchcomplete?: boolean;
  continue?: Record<string, string>;
  query?: {
    pages?: Array<{
      pageid: number;
      title: string;
      coordinates?: Array<{ lat: number; lon: number }>;
      categories?: Array<{ title: string }>;
      thumbnail?: { source: string };
    }>;
  };
};

// One API call, retried a couple of times: Wikipedia answers bursts with
// "too many requests" (plain text, not JSON).
async function wikiQuery(params: Record<string, string>): Promise<WikiQueryResponse> {
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  });
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${WIKI_ENDPOINT}?${query}`).catch(() => null);
    const json = response?.ok
      ? ((await response.json().catch(() => null)) as (WikiQueryResponse & { error?: unknown }) | null)
      : null;
    if (json && !json.error) return json;
    if (attempt >= 2) throw new Error("Wikipedia query failed");
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
}

type SearchHit = {
  title: string;
  lat?: number;
  lon?: number;
  categories: string[];
};

// One search (up to two pages of 500), with each page's coordinates and,
// when given, which of `categories` it belongs to.
async function searchPages(
  search: string,
  categories?: string[],
): Promise<Map<number, SearchHit>> {
  const pages = new Map<number, SearchHit>();
  let next: Record<string, string> = {};
  let searchPages = 0;
  // Category info pages through clcontinue before the next search page.
  for (let round = 0; round < 8; round += 1) {
    const result = await wikiQuery({
      generator: "search",
      gsrsearch: search,
      gsrlimit: "500",
      gsrnamespace: "0",
      prop: categories ? "coordinates|categories" : "coordinates",
      colimit: "max",
      ...(categories
        ? {
            cllimit: "max",
            clcategories: categories.map((name) => `Category:${name}`).join("|"),
          }
        : {}),
      ...next,
    });
    for (const page of result.query?.pages ?? []) {
      const hit = pages.get(page.pageid) ?? { title: page.title, categories: [] };
      const coordinate = page.coordinates?.[0];
      if (coordinate) {
        hit.lat = coordinate.lat;
        hit.lon = coordinate.lon;
      }
      for (const category of page.categories ?? []) hit.categories.push(category.title);
      pages.set(page.pageid, hit);
    }
    if (result.batchcomplete) searchPages += 1;
    if (!result.continue || (result.batchcomplete && searchPages >= 2)) break;
    next = result.continue;
  }
  return pages;
}

// Every geo-located article for these genres (all genres when empty) in the
// prefecture: one OR'd search over its categories — the page's categories
// tell its genre — plus `deepcat` searches that also reach the per-city
// subcategories. `near` keeps only places within reach, so the result pages
// are spent where the trip can actually go.
async function searchCategoryPlaces(
  prefecture: Prefecture,
  genres: DestinationCategory[],
  near?: NearFilter,
): Promise<Destination[]> {
  const wanted = genres.length ? genres : allGenres;
  const wordGenres = new Map<string, DestinationCategory[]>();
  for (const genre of wanted) {
    for (const word of categoryWikiWords[genre]) {
      wordGenres.set(word, [...(wordGenres.get(word) ?? []), genre]);
    }
  }
  // Generic sights for the no-genre search; their genre comes from the title.
  if (!genres.length) wordGenres.set("観光地", []);
  const roots = genres.length
    ? genres.flatMap((genre) => deepWikiRoots[genre].map((root) => ({ root, genre })))
    : [{ root: "観光地", genre: undefined }];

  const area = near
    ? ` nearcoord:${Math.ceil(near.radiusKm)}km,${near.latitude.toFixed(4)},${near.longitude.toFixed(4)}`
    : "";
  const prefix = `Category:${prefecture.nameJa}の`;
  const categories = [...wordGenres.keys()].map((word) => `${prefecture.nameJa}の${word}`);
  const [byCategory, ...deep] = await Promise.all([
    searchPages(`incategory:"${categories.join("|")}"${area}`, categories),
    // A tree too big for deepcat just comes back empty.
    ...roots.map(({ root }) =>
      searchPages(`deepcat:"${prefecture.nameJa}の${root}"${area}`).catch(
        () => new Map<number, SearchHit>(),
      ),
    ),
  ]);

  const found = new Map<number, { hit: SearchHit; genres: Set<DestinationCategory> }>();
  const add = (pageid: number, hit: SearchHit, genresOfHit: DestinationCategory[]) => {
    if (hit.lat == null || hit.lon == null) return;
    const entry = found.get(pageid) ?? { hit, genres: new Set<DestinationCategory>() };
    for (const genre of genresOfHit) entry.genres.add(genre);
    found.set(pageid, entry);
  };
  for (const [pageid, hit] of byCategory) {
    add(
      pageid,
      hit,
      hit.categories.flatMap((title) =>
        title.startsWith(prefix) ? (wordGenres.get(title.slice(prefix.length)) ?? []) : [],
      ),
    );
  }
  deep.forEach((pages, index) => {
    const genre = roots[index].genre;
    for (const [pageid, hit] of pages) add(pageid, hit, genre ? [genre] : []);
  });

  return [...found.entries()]
    .filter(([, { hit }]) => hit.title.trim() && !adminAreaPattern.test(hit.title))
    .map(([pageid, { hit, genres: genresOfHit }]) => ({
      id: `wiki-${pageid}`,
      name: hit.title,
      prefectureId: prefecture.id,
      latitude: hit.lat!,
      longitude: hit.lon!,
      categories: genresOfHit.size
        ? allGenres.filter((genre) => genresOfHit.has(genre))
        : mapCategoryFromTitle(hit.title),
      description: buildDescription(prefecture),
    }));
}

// Wikipedia's lead image for stub articles is often a locator map or other
// SVG-derived graphic rather than a photo — skip those as card thumbnails.
function usableThumbnail(url?: string): string | undefined {
  if (!url) return undefined;
  if (/\.svg([./]|$)/i.test(url)) return undefined;
  if (/location|locator|position|_map|map_of|地図|位置/i.test(url)) return undefined;
  return url;
}

// Geosearch around the prefecture centre — used for the "no genre" (おまかせ)
// path and as a fallback. Limited to a 10km radius by Wikipedia.
async function geosearchAttractions(
  prefecture: Prefecture,
): Promise<Destination[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${prefecture.latitude}|${prefecture.longitude}`,
    gsradius: "10000",
    gslimit: "50",
    format: "json",
    origin: "*",
  });
  const response = await fetch(`${WIKI_ENDPOINT}?${params}`);
  if (!response.ok) throw new Error("Wikipedia geosearch request failed");

  const result = (await response.json()) as WikipediaGeoSearchResponse;
  const items = result.query?.geosearch ?? [];

  return items
    .filter((item) => item.title?.trim() && isLikelyAttraction(item.title))
    .map((item) => ({
      id: `wiki-${item.pageid}`,
      name: item.title,
      prefectureId: prefecture.id,
      latitude: item.lat,
      longitude: item.lon,
      categories: mapCategoryFromTitle(item.title),
      description: buildDescription(prefecture),
    }));
}

// Places to visit in a prefecture: by genre when given (everything
// otherwise), and only within `near` when the trip has a limited reach.
export function getAttractionsByPrefecture(
  prefecture: Prefecture,
  categories: DestinationCategory[] = [],
  near?: NearFilter,
): Promise<SearchProviderResult<Destination[]>> {
  const key = cacheKey(prefecture, categories, near);
  const cached = resultCache.get(key);
  if (cached) return Promise.resolve({ data: cached, provider: "live" });
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = loadAttractions(prefecture, categories, near, key).finally(() =>
    inFlight.delete(key),
  );
  inFlight.set(key, request);
  return request;
}

async function loadAttractions(
  prefecture: Prefecture,
  categories: DestinationCategory[],
  near: NearFilter | undefined,
  key: string,
): Promise<SearchProviderResult<Destination[]>> {
  try {
    let found = await searchCategoryPlaces(prefecture, categories, near);
    if (categories.includes("hot-spring")) {
      found = mergeOnsen(found, await loadOnsen(prefecture), prefecture, near);
    }
    if (found.length || near) {
      // Within a reach, an empty answer is real: nothing of that kind there.
      resultCache.set(key, found);
      return { data: found, provider: "live" };
    }
    // Nothing in the structured categories: try the geosearch around the
    // prefecture centre, keeping only the requested genres if any.
    const nearby = (await geosearchAttractions(prefecture)).filter(
      (place) =>
        !categories.length ||
        place.categories.some((category) => categories.includes(category)),
    );
    if (nearby.length || categories.length) {
      // May be empty for a genre — the caller then says nothing matched.
      if (nearby.length) resultCache.set(key, nearby);
      return { data: nearby, provider: "live" };
    }
    throw new Error("No attractions returned");
  } catch {
    return {
      data: [getFallback(prefecture)],
      provider: "mock",
      notice: "観光情報に接続できなかったため、デモ候補に切り替えました。",
    };
  }
}

type OnsenRecord = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  wiki?: string;
};

const onsenFiles = new Map<string, Promise<OnsenRecord[]>>();

// Onsen from OpenStreetMap (public/data/onsen, built by
// scripts/build-onsen.mjs): Wikipedia has articles for only a fraction.
function loadOnsen(prefecture: Prefecture): Promise<OnsenRecord[]> {
  const cached = onsenFiles.get(prefecture.id);
  if (cached) return cached;
  const request = fetch(`/data/onsen/${prefecture.id}.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`onsen ${response.status}`);
      return response.json() as Promise<OnsenRecord[]>;
    })
    .catch(() => {
      onsenFiles.delete(prefecture.id);
      return [];
    });
  onsenFiles.set(prefecture.id, request);
  return request;
}

const nameCore = (name: string) =>
  displayPlaceName(name).replace(/[\s　・]/g, "").replace(/^天然/, "");

// Adds OSM onsen to the Wikipedia ones. A bath inside an onsen town that
// has its own article ("有馬温泉 金の湯" next to 有馬温泉) folds into it; an
// article whose only namesake bath is far away has bad coordinates (天橋立温泉
// sits in Kyoto city on Wikipedia) and moves to the bath.
function mergeOnsen(
  places: Destination[],
  onsen: OnsenRecord[],
  prefecture: Prefecture,
  near?: NearFilter,
): Destination[] {
  const used = new Set<string>();
  const merged = places.map((place) => {
    if (!place.categories.includes("hot-spring")) return place;
    const core = nameCore(place.name);
    const namesakes = onsen.filter((item) => {
      if (item.wiki === place.name) return true;
      const other = nameCore(item.name);
      const [short, long] = other.length < core.length ? [other, core] : [core, other];
      // "天橋立温泉" ⊂ "天橋立温泉智恵の湯", but not "山の湯" ⊂ "山の湯温泉".
      return short === long || (short.includes("温泉") && long.startsWith(short));
    });
    if (!namesakes.length) return place;
    const close = namesakes.filter((item) => preciseDistanceKm(place, item) <= 10);
    for (const item of close) used.add(item.id);
    if (close.length) return place;
    // Only when the namesakes agree on one spot (not two same-named towns).
    const moved = namesakes[0];
    if (namesakes.some((item) => preciseDistanceKm(item, moved) > 3)) return place;
    for (const item of namesakes) used.add(item.id);
    return { ...place, latitude: moved.latitude, longitude: moved.longitude };
  });

  const kept: Destination[] = [];
  for (const item of onsen) {
    if (used.has(item.id)) continue;
    if (near && preciseDistanceKm(near, item) > near.radiusKm) continue;
    const core = nameCore(item.name);
    // The same bath mapped twice (a point and an outline).
    if (kept.some((other) => nameCore(other.name) === core && preciseDistanceKm(other, item) < 0.5)) {
      continue;
    }
    kept.push({
      id: item.id,
      name: item.name,
      prefectureId: prefecture.id,
      latitude: item.latitude,
      longitude: item.longitude,
      categories: ["hot-spring"],
      description: `${prefecture.nameJa}の温泉。営業時間や料金は、出かける前にチェックしてね。`,
      ...(item.wiki ? { wikiTitle: item.wiki } : {}),
    });
  }
  return [
    ...merged.filter((place) => !near || preciseDistanceKm(near, place) <= near.radiusKm),
    ...kept,
  ];
}

// Everything within `near` across several prefectures, a few searches at a
// time (Wikipedia throttles bursts). Prefectures that fail are left out.
export async function getAttractionsNear(
  prefectureList: Prefecture[],
  near: NearFilter,
): Promise<Map<string, Destination[]>> {
  const found = new Map<string, Destination[]>();
  const queue = [...prefectureList];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const result = await getAttractionsByPrefecture(item, [], near);
      if (result.provider === "live") found.set(item.id, result.data);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return found;
}

// Bulk searches skip images; fetch card thumbnails for a handful of places.
export async function getPlaceThumbnails(
  places: Destination[],
): Promise<Map<string, string>> {
  const ids = places
    .map((place) => place.id.match(/^wiki-(\d+)$/)?.[1])
    .filter((id): id is string => Boolean(id))
    .slice(0, 50);
  const thumbnails = new Map<string, string>();
  if (!ids.length) return thumbnails;
  const result = await wikiQuery({
    pageids: ids.join("|"),
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "600",
    pilimit: "50",
  }).catch(() => null);
  for (const page of result?.query?.pages ?? []) {
    const url = usableThumbnail(page.thumbnail?.source);
    if (url) thumbnails.set(`wiki-${page.pageid}`, url);
  }
  return thumbnails;
}
