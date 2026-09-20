import type { JourneyResult } from "@/types";

// A shareable trip is encoded straight into the URL (no server storage / no
// auth): a compact JSON, base64url. Works in the browser and in edge/node.

export type TripShare = {
  n: string; // destination name
  p: string; // prefecture (ja)
  km: number; // distance
  y: number; // budget total
  img?: string; // hero image url
  c: string[]; // category keys
  t?: number; // temperature
  w?: string; // weather description
};

function toB64url(str: string): string {
  const b64 =
    typeof btoa !== "undefined"
      ? btoa(unescape(encodeURIComponent(str)))
      : Buffer.from(str, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob !== "undefined") {
    return decodeURIComponent(escape(atob(b64)));
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

export function toTripShare(journey: JourneyResult): TripShare {
  return {
    n: journey.destination.name,
    p: journey.prefecture.nameJa,
    km: journey.distanceKm,
    y: journey.estimatedBudget.total,
    img: journey.destination.imageUrl,
    c: journey.destination.categories,
    t: journey.weather?.temperature,
    w: journey.weather?.description,
  };
}

export function encodeTrip(journey: JourneyResult): string {
  return toB64url(JSON.stringify(toTripShare(journey)));
}

export function decodeTrip(d: string): TripShare | null {
  if (!d) return null;
  try {
    const obj = JSON.parse(fromB64url(d)) as Partial<TripShare>;
    if (!obj || typeof obj.n !== "string" || typeof obj.p !== "string") {
      return null;
    }
    return {
      n: obj.n,
      p: obj.p,
      km: Number(obj.km) || 0,
      y: Number(obj.y) || 0,
      img: typeof obj.img === "string" ? obj.img : undefined,
      c: Array.isArray(obj.c) ? obj.c.map(String).slice(0, 6) : [],
      t: typeof obj.t === "number" ? obj.t : undefined,
      w: typeof obj.w === "string" ? obj.w : undefined,
    };
  } catch {
    return null;
  }
}
