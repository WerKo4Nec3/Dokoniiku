"use client";

import { arrayUnion } from "firebase/firestore";
import { useMemo, useSyncExternalStore } from "react";
import { upsertJourneyStatus } from "@/lib/api/trips";
import {
  getActiveTripSnapshot,
  parseActiveTrip,
  storeActiveTrip,
  subscribeActiveTrip,
} from "@/lib/storage/activeTrip";
import { preciseDistanceKm } from "@/lib/utils/travel";
import type { ActiveTrip, JourneyResult } from "@/types";

// The "let's go there" flow: accept Tabi's pick → travel → arrive (ideally
// confirmed by GPS) → write a record. The open trip lives in localStorage
// (synced to the account by <ActiveTripBar />).

export function useActiveTrip(): ActiveTrip | null {
  const snapshot = useSyncExternalStore(subscribeActiveTrip, getActiveTripSnapshot, () => "");
  return useMemo(() => parseActiveTrip(snapshot), [snapshot]);
}

export function readActiveTrip(): ActiveTrip | null {
  return parseActiveTrip(getActiveTripSnapshot());
}

export async function startTrip(journey: JourneyResult, uid?: string) {
  storeActiveTrip({ journey, startedAt: new Date().toISOString() });
  if (uid) await upsertJourneyStatus(uid, journey, "enroute").catch(() => {});
}

export async function markArrived(trip: ActiveTrip, verified: boolean, uid?: string) {
  const now = new Date().toISOString();
  storeActiveTrip({ ...trip, arrivedAt: now, verified });
  // A GPS-confirmed arrival is also a check-in.
  const extra = verified ? { checkIns: arrayUnion(now) } : {};
  if (uid) await upsertJourneyStatus(uid, trip.journey, "exploring", extra).catch(() => {});
}

export function endTrip() {
  storeActiveTrip(null);
}

// Done exploring → the record step (or back to exploring with null).
export function setTripFinished(trip: ActiveTrip, finished: boolean) {
  storeActiveTrip({ ...trip, finishedAt: finished ? new Date().toISOString() : undefined });
}

// Rough door-to-door speed for an ETA (km/h, includes waiting/transfers).
const ETA_SPEED: Record<JourneyResult["transport"], number> = {
  walk: 4.5,
  bicycle: 14,
  motorbike: 35,
  car: 40,
  train: 42,
  shinkansen: 140,
};
export function etaMinutes(km: number, transport: JourneyResult["transport"]): number {
  return Math.max(1, Math.round((km / ETA_SPEED[transport]) * 60));
}

// Big outdoor places (parks, gorges, mountains) get a wider arrival radius.
export function arrivalRadiusKm(journey: JourneyResult): number {
  const wide = journey.destination.categories.some(
    (category) => category === "nature" || category === "viewpoint",
  );
  return wide ? 6 : 3;
}

export type ArrivalCheck =
  | { kind: "here"; km: number }
  | { kind: "far"; km: number }
  | { kind: "unknown"; reason: string };

export function checkArrival(journey: JourneyResult): Promise<ArrivalCheck> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve({ kind: "unknown", reason: "この端末では現在地を取得できません。" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const km = preciseDistanceKm(
          { latitude: position.coords.latitude, longitude: position.coords.longitude },
          journey.destination,
        );
        const rounded = Math.round(km * 10) / 10;
        resolve(
          km <= arrivalRadiusKm(journey)
            ? { kind: "here", km: rounded }
            : { kind: "far", km: rounded },
        );
      },
      () => resolve({ kind: "unknown", reason: "現在地を取得できませんでした。" }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

export function directionsUrl(journey: JourneyResult): string {
  const { latitude, longitude } = journey.destination;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
