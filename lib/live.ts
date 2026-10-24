"use client";

import { useMemo, useSyncExternalStore } from "react";

// The local "I'm sharing my location" session. The position itself is
// written by <LiveShareEngine /> while the app is open — a web page can't
// keep tracking in the background, so sharing pauses when it's closed.
export type LiveShareSession = {
  viewers: string[];
  startedAt: number;
  expiresAt: number;
};

const KEY = "tabi-compass:live-share";
const EVENT = "tabi-compass:live-share-change";

export const SHARE_DURATIONS = [
  { minutes: 15, label: "15分" },
  { minutes: 60, label: "1時間" },
  { minutes: 480, label: "8時間" },
] as const;

function read(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}

export function parseLiveShare(raw: string): LiveShareSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LiveShareSession;
    return Array.isArray(value.viewers) && typeof value.expiresAt === "number" ? value : null;
  } catch {
    return null;
  }
}

export function useLiveShare(): LiveShareSession | null {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseLiveShare(raw), [raw]);
}

export function readLiveShare(): LiveShareSession | null {
  return parseLiveShare(read());
}

export function startLiveShare(viewers: string[], minutes: number) {
  const now = Date.now();
  const session: LiveShareSession = { viewers, startedAt: now, expiresAt: now + minutes * 60000 };
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // storage blocked — sharing still runs for this page
  }
  window.dispatchEvent(new Event(EVENT));
}

export function stopLiveShare() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

export function minutesLeft(session: LiveShareSession, now: number): number {
  return Math.max(0, Math.ceil((session.expiresAt - now) / 60000));
}
