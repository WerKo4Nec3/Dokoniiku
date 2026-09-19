// Nearby practical spots around a destination, from OpenStreetMap via the
// Overpass API — fully keyless and CORS-enabled. Used for the result card's
// "周辺スポット" block (food, onsen, convenience, station, parking, toilets).

export type NearbyCategory =
  | "food"
  | "onsen"
  | "convenience"
  | "station"
  | "parking"
  | "toilets";

export type NearbyGroup = {
  category: NearbyCategory;
  count: number;
  nearest?: { name: string; distanceM: number };
};

type OverpassTags = Record<string, string>;
type OverpassElement = {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OverpassTags;
};

// Several public Overpass mirrors — tried in order so one being busy or
// rate-limited doesn't sink the request.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function runOverpass(query: string): Promise<OverpassElement[]> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) continue;
      const json = (await response.json()) as { elements?: OverpassElement[] };
      if (Array.isArray(json.elements)) return json.elements;
    } catch {
      // try the next mirror (rate-limit, CORS hiccup, XML error page…)
    }
  }
  return [];
}

// Shown in this order; only non-empty groups are returned.
const ORDER: NearbyCategory[] = [
  "food",
  "onsen",
  "convenience",
  "station",
  "parking",
  "toilets",
];

function distanceM(aLat: number, aLon: number, bLat: number, bLon: number) {
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

function classify(tags: OverpassTags): NearbyCategory | null {
  const amenity = tags.amenity ?? "";
  if (["restaurant", "cafe", "fast_food", "food_court"].includes(amenity))
    return "food";
  if (
    amenity === "public_bath" ||
    tags.leisure === "spa" ||
    (tags["bath:type"] ?? "").includes("onsen")
  )
    return "onsen";
  if (tags.shop === "convenience") return "convenience";
  if (
    ["station", "halt"].includes(tags.railway ?? "") ||
    tags.public_transport === "station"
  )
    return "station";
  if (amenity === "parking") return "parking";
  if (amenity === "toilets") return "toilets";
  return null;
}

export async function getNearbyPlaces(
  latitude: number,
  longitude: number,
): Promise<NearbyGroup[]> {
  const c = `${latitude},${longitude}`;
  const query = `[out:json][timeout:20];(
    nwr["amenity"~"^(restaurant|cafe|fast_food|food_court)$"](around:1200,${c});
    nwr["amenity"="public_bath"](around:3000,${c});
    nwr["leisure"="spa"](around:3000,${c});
    nwr["shop"="convenience"](around:1200,${c});
    nwr["railway"~"^(station|halt)$"](around:2500,${c});
    nwr["public_transport"="station"](around:2500,${c});
    nwr["amenity"="parking"](around:1000,${c});
    nwr["amenity"="toilets"](around:1000,${c});
  );out center tags 250;`;

  try {
    const elements = await runOverpass(query);

    const groups = new Map<NearbyCategory, NearbyGroup>();
    for (const el of elements) {
      const tags = el.tags;
      if (!tags) continue;
      const category = classify(tags);
      if (!category) continue;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;

      const group =
        groups.get(category) ?? { category, count: 0 };
      group.count += 1;
      const name = tags.name;
      if (name) {
        const d = Math.round(distanceM(latitude, longitude, lat, lon));
        if (!group.nearest || d < group.nearest.distanceM) {
          group.nearest = { name, distanceM: d };
        }
      }
      groups.set(category, group);
    }

    return ORDER.map((category) => groups.get(category)).filter(
      (g): g is NearbyGroup => Boolean(g && g.count > 0),
    );
  } catch {
    return [];
  }
}
