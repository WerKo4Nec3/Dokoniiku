import type { StartPoint } from "@/types";

const STORAGE_KEY = "tabi-compass:start-point";
const CHANGE_EVENT = "tabi-compass:start-point-change";

export function getStartPointSnapshot(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function subscribeStartPoint(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

export function parseStartPointSnapshot(snapshot: string): StartPoint | null {
  if (!snapshot) return null;

  try {
    const parsed = JSON.parse(snapshot) as Partial<StartPoint>;
    if (
      typeof parsed.name === "string" &&
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number"
    ) {
      return {
        name: parsed.name,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function storeStartPoint(point: StartPoint) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(point));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
