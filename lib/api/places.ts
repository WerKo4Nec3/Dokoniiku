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
import { randomItem } from "@/lib/utils/travel";

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

type WikipediaSearchPage = {
  pageid: number;
  title: string;
  coordinates?: Array<{ lat: number; lon: number }>;
  thumbnail?: { source: string };
};

type WikipediaSearchResponse = {
  query?: { pages?: Record<string, WikipediaSearchPage> };
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
// "奈良県の温泉" or "京都府の城". For each app category we query a few of
// these so a genre search covers the whole prefecture, not just a 10km circle.
const categoryWikiWords: Record<DestinationCategory, string[]> = {
  nature: ["自然公園", "公園", "山", "滝", "渓谷", "湖"],
  history: ["城", "史跡", "古墳", "遺跡"],
  shrine: ["神社", "寺"],
  museum: ["博物館", "美術館"],
  "hot-spring": ["温泉"],
  food: ["道の駅", "酒蔵"],
  viewpoint: ["展望台", "タワー", "山"],
};

// Broad word set for the "surprise me" mode: covers the whole prefecture
// across many kinds of places for far more variety than a 10km geosearch.
const surpriseWords = [
  "観光地",
  "公園",
  "自然公園",
  "山",
  "滝",
  "湖",
  "城",
  "史跡",
  "古墳",
  "神社",
  "寺",
  "博物館",
  "美術館",
  "温泉",
  "展望台",
];

// Cache live results per prefecture + genre so re-rolls don't refetch.
const resultCache = new Map<string, Destination[]>();

function cacheKey(prefecture: Prefecture, categories: DestinationCategory[]) {
  return `${prefecture.id}|${[...categories].sort().join(",")}`;
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

// Fetch the geo-located articles in one per-prefecture Wikipedia category
// (e.g. "奈良県の温泉"), filtered to concrete places.
async function fetchCategoryPages(
  prefecture: Prefecture,
  word: string,
): Promise<WikipediaSearchPage[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `incategory:"${prefecture.nameJa}の${word}"`,
    gsrlimit: "30",
    gsrnamespace: "0",
    prop: "coordinates|pageimages",
    piprop: "thumbnail",
    pithumbsize: "1000",
    format: "json",
    origin: "*",
  });
  const response = await fetch(`${WIKI_ENDPOINT}?${params}`);
  if (!response.ok) throw new Error("Wikipedia category search failed");

  const result = (await response.json()) as WikipediaSearchResponse;
  const pages = result.query?.pages ? Object.values(result.query.pages) : [];
  return pages.filter(
    (page) =>
      page.coordinates?.[0] &&
      page.title?.trim() &&
      !adminAreaPattern.test(page.title),
  );
}

function pageToDestination(
  prefecture: Prefecture,
  page: WikipediaSearchPage,
  categories: DestinationCategory[],
): Destination {
  return {
    id: `wiki-${page.pageid}`,
    name: page.title,
    prefectureId: prefecture.id,
    latitude: page.coordinates![0].lat,
    longitude: page.coordinates![0].lon,
    categories,
    description: buildDescription(prefecture),
    imageUrl: page.thumbnail?.source,
  };
}

// Run several category searches in parallel and flatten to destinations.
// `assign` decides each place's app categories from its title/word.
async function searchWords(
  prefecture: Prefecture,
  tasks: { word: string; category?: DestinationCategory }[],
): Promise<Destination[]> {
  const settled = await Promise.allSettled(
    tasks.map((task) =>
      fetchCategoryPages(prefecture, task.word).then((pages) =>
        pages.map((page) =>
          pageToDestination(
            prefecture,
            page,
            task.category ? [task.category] : mapCategoryFromTitle(page.title),
          ),
        ),
      ),
    ),
  );
  if (settled.every((outcome) => outcome.status === "rejected")) {
    throw new Error("All category searches failed");
  }
  return dedupeById(
    settled.flatMap((outcome) =>
      outcome.status === "fulfilled" ? outcome.value : [],
    ),
  );
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

function dedupeById(destinations: Destination[]): Destination[] {
  const seen = new Set<string>();
  return destinations.filter((destination) => {
    if (seen.has(destination.id)) return false;
    seen.add(destination.id);
    return true;
  });
}

export async function getAttractionsByPrefecture(
  prefecture: Prefecture,
  categories: DestinationCategory[] = [],
): Promise<SearchProviderResult<Destination[]>> {
  const key = cacheKey(prefecture, categories);
  const cached = resultCache.get(key);
  if (cached) return { data: cached, provider: "live" };

  // Genre selected: search the matching per-prefecture categories so the
  // whole prefecture is covered (onsen, castles... are often far from the
  // city centre and out of geosearch range).
  if (categories.length) {
    try {
      const tasks = categories.flatMap((category) =>
        categoryWikiWords[category].map((word) => ({ word, category })),
      );
      const found = await searchWords(prefecture, tasks);
      if (found.length) {
        resultCache.set(key, found);
        return { data: found, provider: "live" };
      }

      // Nothing in the structured categories: try the nearby geosearch and
      // keep only titles that match one of the requested genres.
      const nearby = (await geosearchAttractions(prefecture)).filter((place) =>
        place.categories.some((category) => categories.includes(category)),
      );
      // May be empty — the caller then shows a "no match for this genre" note.
      return { data: nearby, provider: "live" };
    } catch {
      return {
        data: [getFallback(prefecture)],
        provider: "mock",
        notice: "観光情報に接続できなかったため、デモ候補に切り替えました。",
      };
    }
  }

  // No genre (おまかせ): search the whole prefecture across many kinds of
  // places for maximum variety, with a nearby geosearch as a fallback.
  try {
    const found = await searchWords(
      prefecture,
      surpriseWords.map((word) => ({ word })),
    );
    if (found.length) {
      resultCache.set(key, found);
      return { data: found, provider: "live" };
    }
    const nearby = await geosearchAttractions(prefecture);
    if (nearby.length) {
      resultCache.set(key, nearby);
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
