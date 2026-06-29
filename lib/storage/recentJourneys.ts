import type { JourneyResult } from "@/types";

const STORAGE_KEY = "tabi-compass:recent";
const CHANGE_EVENT = "tabi-compass:recent-change";
const MAX_RECENT = 5;

export function getRecentSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return localStorage.getItem(STORAGE_KEY) ?? "[]";
}

export function subscribeRecent(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

export function parseRecentSnapshot(snapshot: string): JourneyResult[] {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? (parsed as JourneyResult[]) : [];
  } catch {
    return [];
  }
}

// Keep the last few generated journeys locally, newest first, capped.
export function pushRecentJourney(journey: JourneyResult) {
  if (typeof window === "undefined") return;
  const current = parseRecentSnapshot(getRecentSnapshot());
  const next = [
    journey,
    ...current.filter((item) => item.id !== journey.id),
  ].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
