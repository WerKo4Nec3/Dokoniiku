import type { ActiveTrip } from "@/types";

// The one trip the traveller is currently on. Kept locally so it survives
// reloads (and works signed out); synced to the account by useActiveTrip.
const STORAGE_KEY = "tabi-compass:active-trip";
const CHANGE_EVENT = "tabi-compass:active-trip-change";

export function getActiveTripSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function subscribeActiveTrip(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

export function parseActiveTrip(snapshot: string): ActiveTrip | null {
  if (!snapshot) return null;
  try {
    const parsed = JSON.parse(snapshot) as Partial<ActiveTrip>;
    if (
      parsed?.journey?.destination?.name &&
      parsed.journey.prefecture?.nameJa &&
      typeof parsed.startedAt === "string"
    ) {
      return parsed as ActiveTrip;
    }
    return null;
  } catch {
    return null;
  }
}

export function storeActiveTrip(trip: ActiveTrip | null) {
  if (typeof window === "undefined") return;
  try {
    if (trip) localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked — the trip just won't survive a reload
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
