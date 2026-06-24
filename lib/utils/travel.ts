import { directions, prefectures } from "@/data/prefectures";
import type {
  Coordinates,
  Destination,
  DestinationCategory,
  Direction,
  EstimatedBudget,
  Prefecture,
  TransportMode,
} from "@/types";

const directionAngle: Record<Direction, number> = {
  北: 0,
  北東: 45,
  東: 90,
  南東: 135,
  南: 180,
  南西: 225,
  西: 270,
  北西: 315,
};

// How strictly a candidate must match the chosen compass direction
// (max degrees of deviation from the exact bearing).
const DIRECTION_TOLERANCE_DEG = 22.5;

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

export function bearingDegrees(from: Coordinates, to: Coordinates): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Prefectures within this distance from the start point count as a
// "nearby" (day-trip friendly) option.
export const NEARBY_PREFECTURE_LIMIT_KM = 350;

export function pickPrefecture(
  direction: Direction,
  start: Coordinates,
  pool: Prefecture[] = prefectures,
): Prefecture {
  const list = pool.length ? pool : prefectures;
  const target = directionAngle[direction];
  const scored = list.map((prefecture) => ({
    prefecture,
    diff: angularDifference(bearingDegrees(start, prefecture), target),
  }));

  // Strict: keep only prefectures genuinely in the chosen direction.
  const within = scored.filter((item) => item.diff <= DIRECTION_TOLERANCE_DEG);
  if (within.length > 0) return randomItem(within).prefecture;

  // None within tolerance: take the single closest by bearing, so e.g.
  // "South" never jumps to East — it picks the most southward option.
  return scored.reduce((best, item) => (item.diff < best.diff ? item : best))
    .prefecture;
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

export const transportInfo: Record<
  TransportMode,
  {
    labelJa: string;
    speedKmh: number;
    yenPerKm: number;
    perPerson: boolean; // fare charged per person (public transit) vs per vehicle
    overheadMin: number;
  }
> = {
  walk: { labelJa: "徒歩", speedKmh: 4.5, yenPerKm: 0, perPerson: false, overheadMin: 0 },
  bicycle: { labelJa: "自転車", speedKmh: 14, yenPerKm: 0, perPerson: false, overheadMin: 0 },
  motorbike: { labelJa: "バイク", speedKmh: 35, yenPerKm: 12, perPerson: false, overheadMin: 10 },
  car: { labelJa: "車", speedKmh: 45, yenPerKm: 20, perPerson: false, overheadMin: 10 },
  train: { labelJa: "電車", speedKmh: 55, yenPerKm: 22, perPerson: true, overheadMin: 20 },
  shinkansen: { labelJa: "新幹線", speedKmh: 160, yenPerKm: 38, perPerson: true, overheadMin: 25 },
};

export const allTransportModes: TransportMode[] = [
  "walk",
  "bicycle",
  "motorbike",
  "car",
  "train",
  "shinkansen",
];

// A transfer adds a last-mile taxi leg, only meaningful for rail trips.
function transferApplies(transport: TransportMode, transfer: boolean): boolean {
  return transfer && (transport === "train" || transport === "shinkansen");
}

function travelMinutes(
  distanceKm: number,
  transport: TransportMode,
  transfer: boolean,
): number {
  const info = transportInfo[transport];
  let minutes = (distanceKm / info.speedKmh) * 60 + info.overheadMin;
  if (transferApplies(transport, transfer)) minutes += 20; // last-mile taxi
  return Math.max(15, Math.round(minutes));
}

export function estimateTravelTime(
  destination: Destination,
  start: Coordinates,
  transport: TransportMode = "train",
  transfer: boolean = false,
): {
  distanceKm: number;
  minutes: number;
} {
  const distanceKm = haversineDistanceKm(start, destination);
  return { distanceKm, minutes: travelMinutes(distanceKm, transport, transfer) };
}

function roundToHundred(value: number) {
  return Math.round(value / 100) * 100;
}

function transportCostFor(
  distanceKm: number,
  people: number,
  transport: TransportMode,
  transfer: boolean,
): number {
  const headcount = Math.max(1, Math.round(people));
  const info = transportInfo[transport];
  let cost = roundToHundred(distanceKm * info.yenPerKm * 2); // round trip
  if (info.perPerson) cost *= headcount;
  if (info.yenPerKm > 0) {
    cost = Math.max(info.perPerson ? 300 * headcount : 600, cost);
  }
  if (transferApplies(transport, transfer)) cost += 3000; // taxi round trip (group)
  return cost;
}

export function estimateBudget(
  distanceKm: number,
  categories: DestinationCategory[],
  people: number = 1,
  transport: TransportMode = "train",
  transfer: boolean = false,
): EstimatedBudget {
  const headcount = Math.max(1, Math.round(people));
  const [minimum, maximum] = activityRanges[categories[0] ?? "nature"];
  const perActivity = roundToHundred((minimum + maximum) / 2);
  const perFood = 1200;

  const transportCost = transportCostFor(distanceKm, headcount, transport, transfer);
  const activityCost = perActivity * headcount;
  const foodCost = perFood * headcount;

  return {
    transportCost,
    activityCost,
    foodCost,
    total: transportCost + activityCost + foodCost,
  };
}

// From the allowed transport modes, pick the cheapest option that fits both
// the time budget and the money budget. Returns null if nothing fits.
export function bestTransport(opts: {
  distanceKm: number;
  categories: DestinationCategory[];
  people: number;
  modes: TransportMode[];
  transfer: boolean;
  maxBudget: number;
  maxOneWayMinutes: number;
}): { mode: TransportMode; minutes: number; total: number } | null {
  let best: { mode: TransportMode; minutes: number; total: number } | null = null;
  for (const mode of opts.modes) {
    const minutes = travelMinutes(opts.distanceKm, mode, opts.transfer);
    if (minutes > opts.maxOneWayMinutes) continue;
    const total = estimateBudget(
      opts.distanceKm,
      opts.categories,
      opts.people,
      mode,
      opts.transfer,
    ).total;
    if (total > opts.maxBudget) continue;
    if (!best || total < best.total) best = { mode, minutes, total };
  }
  return best;
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `約${remainingMinutes}分`;
  return `約${hours}時間${remainingMinutes ? `${remainingMinutes}分` : ""}`;
}

export function transportLabel(transport: TransportMode, transfer: boolean) {
  const base = transportInfo[transport].labelJa;
  return transferApplies(transport, transfer) ? `${base}＋タクシー` : base;
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
