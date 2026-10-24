import { preciseDistanceKm } from "@/lib/utils/travel";

// GET /api/food?lat=..&lon=..[&name=..] → { source, places, venue }
// Restaurants & cafés with their budget, from the HotPepper Gourmet API
// (Recruit). It needs a free key (HOTPEPPER_API_KEY, server-only); without
// one this answers { source: null } and the page falls back to OpenStreetMap
// eateries (names only — OSM has no prices). With `name`, `venue` is the
// destination itself when HotPepper lists it (matched by name, ≤1 km).

export type FoodPlace = {
  name: string;
  genre?: string;
  budget?: string;
  catch?: string;
  photo?: string;
  url?: string;
  open?: string;
  latitude: number;
  longitude: number;
  distanceM: number;
};

type Shop = {
  name: string;
  lat: number | string;
  lng: number | string;
  genre?: { name?: string };
  budget?: { name?: string; average?: string };
  catch?: string;
  photo?: { pc?: { m?: string } };
  urls?: { pc?: string };
  open?: string;
};

// `average` is free text; some shops put notes there ("キャッシュレスのみ…").
// Use it only when it looks like a price, else the budget band name.
function pickBudget(budget: Shop["budget"]): string | undefined {
  const average = budget?.average?.trim();
  if (average && /\d/.test(average) && average.length <= 24) return average;
  return budget?.name?.trim() || undefined;
}

const norm = (text: string) =>
  text.replace(/\s*[(（][^()（）]*[)）]$/, "").replace(/[\s　・「」『』\-‐]/g, "").toLowerCase();

function toPlace(shop: Shop, lat: number, lon: number): FoodPlace {
  const point = { latitude: Number(shop.lat), longitude: Number(shop.lng) };
  return {
    name: shop.name,
    genre: shop.genre?.name || undefined,
    budget: pickBudget(shop.budget),
    catch: shop.catch || undefined,
    photo: shop.photo?.pc?.m,
    url: shop.urls?.pc,
    open: shop.open,
    ...point,
    distanceM: Math.round(preciseDistanceKm({ latitude: lat, longitude: lon }, point) * 1000),
  };
}

async function search(params: Record<string, string>): Promise<Shop[]> {
  const response = await fetch(
    `https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?${new URLSearchParams(params)}`,
    { next: { revalidate: 3600 } },
  );
  if (!response.ok) throw new Error(`HotPepper ${response.status}`);
  const data = (await response.json()) as { results?: { shop?: Shop[] } };
  return data.results?.shop ?? [];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ source: null, places: [] }, { status: 400 });
  }
  const key = process.env.HOTPEPPER_API_KEY;
  if (!key) return Response.json({ source: null, places: [] });

  const name = (searchParams.get("name") ?? "").trim().slice(0, 60);
  const base = { key, lat: lat.toFixed(4), lng: lon.toFixed(4), format: "json" };
  try {
    const [nearby, named] = await Promise.all([
      search({ ...base, range: "3", count: "12" }), // 1000 m
      name ? search({ ...base, range: "3", count: "5", keyword: norm(name) }).catch(() => []) : [],
    ]);
    const places = nearby.map((shop) => toPlace(shop, lat, lon)).sort((x, y) => x.distanceM - y.distanceM);
    // Only a real name match counts as "this place" — never a random shop.
    const wanted = norm(name);
    const match = named.find((shop) => {
      const shopName = norm(shop.name);
      return wanted.length >= 2 && (shopName.includes(wanted) || wanted.includes(shopName));
    });
    return Response.json(
      { source: "hotpepper", places, venue: match ? toPlace(match, lat, lon) : null },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ source: null, places: [] });
  }
}
