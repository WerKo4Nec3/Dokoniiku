import { useMemo, useSyncExternalStore } from "react";
import type { DestinationCategory } from "@/types";

// The traveller's favourite genres, stored locally. They softly bias the
// "surprise me" pick toward places the user tends to like — never a hard
// filter, so discovery still happens.

const PREF_KEY = "tabi-compass:preferences";
const ONBOARDED_KEY = "tabi-compass:pref-onboarded";
const PREF_EVENT = "tabi-compass:prefs-change";
const OPEN_EVENT = "tabi-compass:open-preferences";

// Order shown in the picker (roughly most-loved first).
export const PREFERENCE_CATEGORIES: DestinationCategory[] = [
  "nature",
  "viewpoint",
  "hot-spring",
  "food",
  "shrine",
  "history",
  "museum",
];

export const CATEGORY_EMOJI: Record<DestinationCategory, string> = {
  nature: "🌲",
  history: "🏯",
  shrine: "⛩️",
  museum: "🏛️",
  "hot-spring": "♨️",
  food: "🍜",
  viewpoint: "🗻",
};

export function readPreferences(): DestinationCategory[] {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is DestinationCategory =>
      PREFERENCE_CATEGORIES.includes(c as DestinationCategory),
    );
  } catch {
    return [];
  }
}

export function writePreferences(categories: DestinationCategory[]) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(categories));
    window.dispatchEvent(new Event(PREF_EVENT));
  } catch {
    // storage unavailable (private mode etc.) — preferences just won't persist
  }
}

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true; // can't remember → don't nag
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // ignore
  }
}

// Ask the PreferencesDialog (mounted at the layout root) to open.
export function openPreferences() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
export const PREFERENCES_OPEN_EVENT = OPEN_EVENT;

// ---- React hook: current preferences, synced across components ----

function subscribe(listener: () => void) {
  window.addEventListener(PREF_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(PREF_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function usePreferences(): DestinationCategory[] {
  // Snapshot the raw string (stable when unchanged) to avoid re-render loops,
  // then parse into an array with useMemo.
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(PREF_KEY) ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  return useMemo(() => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((c): c is DestinationCategory =>
        PREFERENCE_CATEGORIES.includes(c as DestinationCategory),
      );
    } catch {
      return [];
    }
  }, [raw]);
}
