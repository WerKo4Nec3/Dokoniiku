// What's around a destination: the nearby-spot groups AND the menu info, from a
// SINGLE Overpass query. Public mirrors allow only ~2 concurrent slots per IP,
// so the result page must never fire two queries for one place.

import { overpassQuery } from "@/lib/overpass";
import { aroundQuery, groupNearby, type NearbyGroup } from "@/lib/api/nearby";
import { menuFromElements, type MenuInfo } from "@/lib/api/menu";

export type AroundInfo = { groups: NearbyGroup[]; menu: MenuInfo | null };

const EMPTY: AroundInfo = { groups: [], menu: null };

// SERVER
export async function computeAround(
  latitude: number,
  longitude: number,
  name?: string,
): Promise<AroundInfo> {
  const elements = await overpassQuery(aroundQuery(latitude, longitude));
  return {
    groups: groupNearby(elements, latitude, longitude),
    menu: name ? menuFromElements(elements, name, latitude, longitude) : null,
  };
}

// CLIENT — one in-flight request per place, shared by NearbyCard + MenuCard.
const inflight = new Map<string, Promise<AroundInfo>>();

async function load(key: string, params: URLSearchParams): Promise<AroundInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);
  try {
    const response = await fetch(`/api/nearby?${params}`, {
      signal: controller.signal,
    });
    if (!response.ok) return EMPTY;
    const json = (await response.json()) as Partial<AroundInfo>;
    return {
      groups: Array.isArray(json.groups) ? json.groups : [],
      menu: json.menu ?? null,
    };
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timer);
    // Keep good answers for this session; retry failures next time.
    inflight.get(key)?.then((r) => {
      if (!r.groups.length && !r.menu?.eateries.length) inflight.delete(key);
    });
  }
}

export function fetchAround(
  latitude: number,
  longitude: number,
  name?: string,
): Promise<AroundInfo> {
  const params = new URLSearchParams({
    lat: latitude.toFixed(4),
    lon: longitude.toFixed(4),
  });
  if (name) params.set("name", name.slice(0, 80));
  const key = params.toString();
  let pending = inflight.get(key);
  if (!pending) {
    pending = load(key, params);
    inflight.set(key, pending);
  }
  return pending;
}
