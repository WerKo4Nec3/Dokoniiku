import { preciseDistanceKm } from "@/lib/utils/travel";

// "ここで楽しむ": notable places around a destination (Wikipedia articles
// with coordinates), with a thumbnail and a one-line description.

export type Sight = {
  pageid: number;
  title: string;
  name: string;
  description?: string;
  thumbnail?: string;
  latitude: number;
  longitude: number;
  distanceM: number;
};

const NOT_A_SIGHT =
  /(市|町|村|区|郡|丁目|地方|道路|線|インターチェンジ|ジャンクション|交差点|学校|大学|病院|郵便局|警察署|消防署|役所|役場|ホテル|事故|事件|遭難|災害|一覧)$/;

type Page = {
  pageid: number;
  title: string;
  description?: string;
  thumbnail?: { source: string };
  coordinates?: { lat: number; lon: number }[];
};

export async function nearbySights(
  latitude: number,
  longitude: number,
  exclude: string[] = [],
): Promise<Sight[]> {
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "geosearch",
      ggscoord: `${latitude}|${longitude}`,
      ggsradius: "3000",
      ggslimit: "30",
      prop: "pageimages|coordinates|description",
      piprop: "thumbnail",
      pithumbsize: "250",
      colimit: "max",
      format: "json",
      origin: "*",
    });
    const response = await fetch(`https://ja.wikipedia.org/w/api.php?${params}`);
    if (!response.ok) return [];
    const data = (await response.json()) as { query?: { pages?: Record<string, Page> } };
    const skip = new Set(exclude.map((name) => name.replace(/\s*\(.*\)$/, "")));
    return Object.values(data.query?.pages ?? {})
      .filter((page) => page.coordinates?.[0])
      .map((page) => {
        const name = page.title.replace(/\s*\(.*\)$/, "");
        const point = { latitude: page.coordinates![0].lat, longitude: page.coordinates![0].lon };
        return {
          pageid: page.pageid,
          title: page.title,
          name,
          description: page.description,
          thumbnail: page.thumbnail?.source,
          ...point,
          distanceM: Math.round(preciseDistanceKm({ latitude, longitude }, point) * 1000),
        };
      })
      .filter((sight) => !NOT_A_SIGHT.test(sight.name) && !skip.has(sight.name) && sight.distanceM > 40)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 8);
  } catch {
    return [];
  }
}
