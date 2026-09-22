// Nearby practical spots around a destination (food, onsen, convenience,
// station, parking, toilets) from OpenStreetMap. Pure helpers only — the
// Overpass call and the browser fetch live in lib/api/around.ts so the nearby
// block and the menu block share ONE request per place.

import {
  distanceM,
  elementCoords,
  type OverpassElement,
  type OverpassTags,
} from "@/lib/overpass";

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

// Shown in this order; only non-empty groups are returned.
const ORDER: NearbyCategory[] = [
  "food",
  "onsen",
  "convenience",
  "station",
  "parking",
  "toilets",
];

// One query covers the nearby block AND the menu block (eateries + their tags).
export function aroundQuery(latitude: number, longitude: number): string {
  const c = `${latitude},${longitude}`;
  return `[out:json][timeout:15];(
    nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"](around:1200,${c});
    nwr["amenity"="public_bath"](around:3000,${c});
    nwr["leisure"="spa"](around:3000,${c});
    nwr["shop"="convenience"](around:1200,${c});
    nwr["railway"~"^(station|halt)$"](around:2500,${c});
    nwr["public_transport"="station"](around:2500,${c});
    nwr["amenity"="parking"](around:1000,${c});
    nwr["amenity"="toilets"](around:1000,${c});
  );out center tags 300;`;
}

function classify(tags: OverpassTags): NearbyCategory | null {
  const amenity = tags.amenity ?? "";
  if (["restaurant", "cafe", "fast_food", "food_court", "ice_cream"].includes(amenity))
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

export function groupNearby(
  elements: OverpassElement[],
  latitude: number,
  longitude: number,
): NearbyGroup[] {
  const groups = new Map<NearbyCategory, NearbyGroup>();
  for (const el of elements) {
    if (!el.tags) continue;
    const category = classify(el.tags);
    if (!category) continue;
    const pos = elementCoords(el);
    if (!pos) continue;
    const group = groups.get(category) ?? { category, count: 0 };
    group.count += 1;
    const name = el.tags.name;
    if (name) {
      const d = Math.round(distanceM(latitude, longitude, pos.lat, pos.lon));
      if (!group.nearest || d < group.nearest.distanceM) {
        group.nearest = { name, distanceM: d };
      }
    }
    groups.set(category, group);
  }
  return ORDER.map((category) => groups.get(category)).filter(
    (g): g is NearbyGroup => Boolean(g && g.count > 0),
  );
}
