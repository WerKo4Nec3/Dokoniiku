import { directions, prefectures } from "@/data/prefectures";
import type {
  Coordinates,
  Destination,
  DestinationCategory,
  Direction,
  EstimatedBudget,
  Prefecture,
} from "@/types";

const compassOrder: Direction[] = [
  "北",
  "北東",
  "東",
  "南東",
  "南",
  "南西",
  "西",
  "北西",
];

const activityRanges: Record<DestinationCategory, [number, number]> = {
  nature: [0, 500],
  history: [500, 1200],
  shrine: [0, 500],
  museum: [800, 1500],
  "hot-spring": [1000, 2500],
  food: [1500, 3000],
  viewpoint: [0, 800],
};

export function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function pickDirection(): Direction {
  return randomItem(directions);
}

export function directionFrom(from: Coordinates, to: Coordinates): Direction {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return compassOrder[Math.round(bearing / 45) % 8];
}

const nearbyDirections: Record<Direction, Direction[]> = {
  北: ["北東", "北西"],
  南: ["南東", "南西"],
  東: ["北東", "南東"],
  西: ["北西", "南西"],
  北東: ["北", "東"],
  北西: ["北", "西"],
  南東: ["南", "東"],
  南西: ["南", "西"],
};

// Prefectures within this distance from the start point count as a
// "nearby" (day-trip friendly) option.
export const NEARBY_PREFECTURE_LIMIT_KM = 350;

export function pickPrefecture(
  direction: Direction,
  start: Coordinates,
  pool: Prefecture[] = prefectures,
): Prefecture {
  const list = pool.length ? pool : prefectures;

  const exact = list.filter(
    (prefecture) => directionFrom(start, prefecture) === direction,
  );
  if (exact.length > 0) return randomItem(exact);

  const nearby = list.filter((prefecture) =>
    nearbyDirections[direction].includes(directionFrom(start, prefecture)),
  );
  if (nearby.length > 0) return randomItem(nearby);

  return randomItem(list);
}

export function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const radius = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(lonDelta / 2) ** 2;

  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function estimateTravelTime(
  destination: Destination,
  start: Coordinates,
): {
  distanceKm: number;
  minutes: number;
} {
  const distanceKm = haversineDistanceKm(start, destination);
  return {
    distanceKm,
    minutes: Math.max(35, Math.round((distanceKm / 45) * 60 + 20)),
  };
}

function roundToHundred(value: number) {
  return Math.round(value / 100) * 100;
}

export function estimateBudget(
  distanceKm: number,
  categories: DestinationCategory[],
): EstimatedBudget {
  const transportCost = Math.max(600, roundToHundred(distanceKm * 24 * 2));
  const [minimum, maximum] = activityRanges[categories[0] ?? "nature"];
  const activityCost = roundToHundred((minimum + maximum) / 2);
  const foodCost = 1200;

  return {
    transportCost,
    activityCost,
    foodCost,
    total: transportCost + activityCost + foodCost,
  };
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `約${remainingMinutes}分`;
  return `約${hours}時間${remainingMinutes ? `${remainingMinutes}分` : ""}`;
}

export function googleMapsSearchUrl(
  destination: Pick<Destination, "name" | "latitude" | "longitude">,
) {
  const { name, latitude, longitude } = destination;
  const query = encodeURIComponent(name);
  // Search by name but centred on the exact Wikipedia coordinates, so Google
  // resolves the actual place (its POI card) instead of dropping a raw pin on
  // the coordinates or matching a same-named place elsewhere.
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `https://www.google.com/maps/search/${query}/@${latitude},${longitude},16z`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

export const categoryLabels: Record<DestinationCategory, string> = {
  nature: "自然",
  history: "歴史",
  shrine: "神社・寺",
  museum: "ミュージアム",
  "hot-spring": "温泉",
  food: "グルメ",
  viewpoint: "絶景",
};
