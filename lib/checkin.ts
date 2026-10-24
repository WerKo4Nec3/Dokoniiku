"use client";

import { arrayUnion, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { prefectures } from "@/data/prefectures";
import type { EventSpot, TravelEvent } from "@/data/events";
import { db } from "@/lib/firebase";
import { getDestinationSummary } from "@/lib/api/wikipedia";
import { getWeatherByCoordinates } from "@/lib/api/weather";
import { notifyJourneysChanged } from "@/lib/journeyEvents";
import { arrivalRadiusKm } from "@/lib/trips";
import {
  directionTowards,
  estimateBudget,
  estimateTravelTime,
  preciseDistanceKm,
} from "@/lib/utils/travel";
import type {
  Destination,
  DestinationCategory,
  JourneyResult,
  Prefecture,
  SavedJourney,
  StartPoint,
} from "@/types";

// GPS check-in (現地チェックイン): confirm you're really at a place — one
// you saved, a quest spot, or any notable place around you — and get a
// 現地認証 stamp for it.

export type Position = { lat: number; lon: number; accuracy: number };

/** Fixes worse than this (IP/Wi-Fi guesses) can't verify a visit. */
export const MAX_ACCURACY_M = 1500;
/** Notable places from the map count when you're this close. */
const PLACE_RADIUS_KM = 1;
/** Saved places / quest spots further than this aren't listed at all. */
const LIST_RADIUS_KM = 15;

export function locate(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("この端末では現在地を取得できません。"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "位置情報の利用が許可されていません。ブラウザの設定で許可してね。"
              : "現在地を取得できませんでした。屋外でもう一度試してね。",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

// Prefectures in JIS X 0401 order (code = index + 1).
const JIS = [
  "hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima",
  "ibaraki", "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa",
  "niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano", "gifu",
  "shizuoka", "aichi", "mie", "shiga", "kyoto", "osaka", "hyogo", "nara",
  "wakayama", "tottori", "shimane", "okayama", "hiroshima", "yamaguchi",
  "tokushima", "kagawa", "ehime", "kochi", "fukuoka", "saga", "nagasaki",
  "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa",
];

// Which prefecture a point is in: GSI's keyless reverse geocoder, falling
// back to the nearest prefectural capital.
export async function prefectureAt(lat: number, lon: number): Promise<Prefecture> {
  try {
    const response = await fetch(
      `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lon}`,
    );
    const data = (await response.json()) as { results?: { muniCd?: string } };
    const code = Number(data.results?.muniCd?.slice(0, 2));
    const found = prefectures.find((item) => item.id === JIS[code - 1]);
    if (found) return found;
  } catch {
    // fall through
  }
  return prefectures.reduce((best, item) =>
    preciseDistanceKm({ latitude: lat, longitude: lon }, item) <
    preciseDistanceKm({ latitude: lat, longitude: lon }, best)
      ? item
      : best,
  );
}

export type NearbyPlace = { pageid: number; title: string; lat: number; lon: number; distM: number };

// Not things you "visit": municipalities, roads, schools, offices…
const NOT_A_PLACE =
  /(市|町|村|区|郡|丁目|地方|道路|線|インターチェンジ|ジャンクション|交差点|小学校|中学校|高等学校|大学|病院|郵便局|警察署|消防署|役所|役場|一覧)$/;

// Notable places (Wikipedia articles) within ~1.5km.
export async function nearbyNotable(lat: number, lon: number): Promise<NearbyPlace[]> {
  try {
    const response = await fetch(
      `https://ja.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=1500&gslimit=30&format=json&origin=*`,
    );
    const data = (await response.json()) as {
      query?: { geosearch?: { pageid: number; title: string; lat: number; lon: number; dist: number }[] };
    };
    return (data.query?.geosearch ?? [])
      .filter((item) => !NOT_A_PLACE.test(item.title.replace(/\s*\(.*\)$/, "")))
      .slice(0, 12)
      .map((item) => ({ pageid: item.pageid, title: item.title, lat: item.lat, lon: item.lon, distM: item.dist }));
  } catch {
    return [];
  }
}

// Best-effort genre from an article title.
export function guessCategories(title: string): DestinationCategory[] {
  const name = title.replace(/\s*\(.*\)$/, "");
  const rules: [RegExp, DestinationCategory][] = [
    [/(神社|大社|宮|寺|院|堂|稲荷|八幡)$/, "shrine"],
    [/(城|城跡|古墳|遺跡|宿|関所|陣屋|屋敷)/, "history"],
    [/(温泉|湯)/, "hot-spring"],
    [/(美術館|博物館|資料館|記念館|科学館|水族館)/, "museum"],
    [/(市場|横丁|商店街|屋台)/, "food"],
    [/(展望|タワー|橋|灯台|岬)/, "viewpoint"],
    [/(山|岳|峰|滝|渓|峡|湖|池|沼|川|公園|庭園|園|海岸|浜|島|森|高原|湿原)/, "nature"],
  ];
  const found = rules.filter(([pattern]) => pattern.test(name)).map(([, category]) => category);
  return found.length ? [...new Set(found)].slice(0, 2) : ["viewpoint"];
}

export type CheckInTarget =
  | { kind: "saved"; journey: SavedJourney }
  | { kind: "quest"; event: TravelEvent; spot: EventSpot }
  | { kind: "place"; place: NearbyPlace };

export type Candidate = {
  key: string;
  target: CheckInTarget;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  km: number;
  radiusKm: number;
  doneToday: boolean;
};

const sameDay = (iso: string, now: Date) => new Date(iso).toDateString() === now.toDateString();

// Everything you could check in to from here: `here` (within range) and
// `near` (saved/quest places a bit too far, to show how close you are).
export function buildCandidates(
  position: Position,
  journeys: SavedJourney[],
  places: NearbyPlace[],
  events: TravelEvent[],
  now: Date,
): { here: Candidate[]; near: Candidate[] } {
  const me = { latitude: position.lat, longitude: position.lon };
  const all: Candidate[] = [];

  const saved = journeys.filter((journey) => preciseDistanceKm(me, journey.destination) <= LIST_RADIUS_KM);
  // One entry per place, even if it was saved more than once.
  const seenPlaces = new Set<string>();
  for (const journey of saved) {
    if (seenPlaces.has(journey.destination.id)) continue;
    seenPlaces.add(journey.destination.id);
    all.push({
      key: `saved-${journey.id}`,
      target: { kind: "saved", journey },
      name: journey.destination.name,
      subtitle: `保存した旅・${journey.prefecture.nameJa}`,
      latitude: journey.destination.latitude,
      longitude: journey.destination.longitude,
      km: preciseDistanceKm(me, journey.destination),
      radiusKm: arrivalRadiusKm(journey),
      doneToday: Boolean(journey.checkIns?.some((iso) => sameDay(iso, now))),
    });
  }

  const nearSaved = (point: { latitude: number; longitude: number }, km: number) =>
    saved.some((journey) => preciseDistanceKm(point, journey.destination) <= km);

  for (const event of events) {
    for (const spot of event.spots) {
      const km = preciseDistanceKm(me, spot);
      if (km > LIST_RADIUS_KM || nearSaved(spot, 1)) continue;
      all.push({
        key: `quest-${event.id}-${spot.id}`,
        target: { kind: "quest", event, spot },
        name: spot.name,
        subtitle: `${event.title}の名所`,
        latitude: spot.latitude,
        longitude: spot.longitude,
        km,
        radiusKm: 6,
        doneToday: false,
      });
    }
  }

  for (const place of places) {
    const point = { latitude: place.lat, longitude: place.lon };
    const isQuestSpot = events.some((event) =>
      event.spots.some((spot) => preciseDistanceKm(point, spot) <= 0.5),
    );
    if (
      isQuestSpot ||
      nearSaved(point, 0.3) ||
      journeys.some((journey) => journey.destination.id === `wiki-${place.pageid}`)
    ) {
      continue;
    }
    all.push({
      key: `place-${place.pageid}`,
      target: { kind: "place", place },
      name: place.title.replace(/\s*\(.*\)$/, ""),
      subtitle: "近くの名所",
      latitude: place.lat,
      longitude: place.lon,
      km: place.distM / 1000,
      radiusKm: PLACE_RADIUS_KM,
      doneToday: false,
    });
  }

  all.sort((a, b) => a.km - b.km);
  return {
    here: all.filter((item) => item.km <= item.radiusKm),
    near: all.filter((item) => item.km > item.radiusKm && item.target.kind !== "place").slice(0, 6),
  };
}

// A full journey for a place that wasn't saved yet (quest spot or nearby).
async function buildJourney(destination: Destination, start: StartPoint, now: string): Promise<JourneyResult> {
  const knownPrefecture = prefectures.find((item) => item.id === destination.prefectureId);
  const [prefecture, summary, weather] = await Promise.all([
    knownPrefecture ?? prefectureAt(destination.latitude, destination.longitude),
    getDestinationSummary(destination.wikiTitle ?? destination.name),
    getWeatherByCoordinates(destination.latitude, destination.longitude),
  ]);
  const full: Destination = {
    ...destination,
    prefectureId: prefecture.id,
    description: summary?.description ?? destination.description,
    imageUrl: destination.imageUrl ?? summary?.imageUrl,
  };
  const travel = estimateTravelTime(full, start, "train", false);
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${full.id}`,
    createdAt: now,
    direction: directionTowards(start, full),
    start,
    prefecture,
    destination: full,
    weather: weather.data,
    estimatedBudget: estimateBudget(travel.distanceKm, full.categories, 1, "train", false),
    estimatedTravelTime: travel.minutes,
    distanceKm: travel.distanceKm,
    people: 1,
    transport: "train",
    transfer: false,
    isMock: false,
  };
}

// Record the check-in: the place becomes 完了 with a GPS-confirmed visit.
export async function performCheckIn(
  uid: string,
  target: CheckInTarget,
  start: StartPoint,
): Promise<SavedJourney> {
  if (!db) throw new Error("no db");
  const now = new Date().toISOString();

  if (target.kind === "saved") {
    await updateDoc(doc(db, "users", uid, "journeys", target.journey.id), {
      status: "done",
      visited: true,
      checkIns: arrayUnion(now),
    });
    notifyJourneysChanged();
    return {
      ...target.journey,
      status: "done",
      visited: true,
      checkIns: [...(target.journey.checkIns ?? []), now],
    };
  }

  const destination: Destination =
    target.kind === "quest"
      ? {
          id: `quest-${target.event.id}-${target.spot.id}`,
          name: target.spot.name,
          wikiTitle: target.spot.wiki,
          prefectureId: target.spot.prefectureId,
          latitude: target.spot.latitude,
          longitude: target.spot.longitude,
          categories: target.event.categories.slice(0, 2),
          description: target.spot.note,
          imageUrl: target.spot.image,
        }
      : {
          id: `wiki-${target.place.pageid}`,
          name: target.place.title.replace(/\s*\(.*\)$/, ""),
          wikiTitle: target.place.title,
          prefectureId: "",
          latitude: target.place.lat,
          longitude: target.place.lon,
          categories: guessCategories(target.place.title),
          description: "",
        };
  const journey = await buildJourney(destination, start, now);
  const saved: SavedJourney = { ...journey, status: "done", visited: true, checkIns: [now] };
  await setDoc(doc(db, "users", uid, "journeys", journey.id), { ...saved, savedAt: serverTimestamp() });
  notifyJourneysChanged();
  return saved;
}
