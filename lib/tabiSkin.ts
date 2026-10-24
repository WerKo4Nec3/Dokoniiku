"use client";

import { useMemo, useSyncExternalStore } from "react";

// Tabi's wardrobe (きせかえ). Colour variants are CSS filters over the
// existing sprites, so they work with every pose; outfit skins can add their
// own sprite set later (`sprites`). Effects are small particles around Tabi.

export type TabiPose = "waving" | "pointing" | "map" | "camera" | "walking";
export type SkinEffect = "sparkle" | "maple" | "sakura" | "snow";

export type SkinUnlock =
  | { kind: "free" }
  | { kind: "level"; level: number }
  | { kind: "quest"; eventId: string; goalId: string; label: string };

export type TabiSkin = {
  id: string;
  name: string;
  description: string;
  filter?: string;
  effect?: SkinEffect;
  /** Custom art per pose (outfits); falls back to the default sprites. */
  sprites?: Partial<Record<TabiPose, string>>;
  unlock: SkinUnlock;
};

export const TABI_SKINS: TabiSkin[] = [
  { id: "classic", name: "いつものタビ", description: "旅立ちの日の姿。", unlock: { kind: "free" } },
  {
    id: "sora",
    name: "そらいろ",
    description: "青空みたいなとさか。",
    filter: "hue-rotate(195deg) saturate(1.05)",
    unlock: { kind: "free" },
  },
  {
    id: "wakaba",
    name: "わかば",
    description: "新緑の山を歩いてきた色。",
    filter: "hue-rotate(95deg) saturate(0.9)",
    unlock: { kind: "level", level: 2 },
  },
  {
    id: "sakura",
    name: "さくら",
    description: "春風といっしょに。花びらが舞う。",
    filter: "hue-rotate(-28deg) saturate(0.8) brightness(1.05)",
    effect: "sakura",
    unlock: { kind: "level", level: 3 },
  },
  {
    id: "yozora",
    name: "よぞら",
    description: "星を見上げる夜のタビ。",
    filter: "hue-rotate(235deg) saturate(1.25) brightness(0.92)",
    effect: "sparkle",
    unlock: { kind: "level", level: 5 },
  },
  {
    id: "momiji",
    name: "もみじ",
    description: "紅葉狩りクエストのごほうび。",
    filter: "hue-rotate(-14deg) saturate(1.45)",
    effect: "maple",
    unlock: { kind: "quest", eventId: "momiji", goalId: "first", label: "紅葉狩りクエストを1つ達成" },
  },
  {
    id: "yukimi",
    name: "ゆきみ",
    description: "雪見湯めぐりのごほうび。",
    filter: "saturate(0.35) brightness(1.08)",
    effect: "snow",
    unlock: { kind: "quest", eventId: "yukimi", goalId: "first", label: "雪見湯めぐりクエストを1つ達成" },
  },
  {
    id: "gold",
    name: "黄金のタビ",
    description: "旅を極めた者だけが手にする輝き。",
    filter: "sepia(1) saturate(2.4) hue-rotate(-10deg) brightness(1.03)",
    effect: "sparkle",
    unlock: { kind: "level", level: 12 },
  },
];

const KEY = "tabi-compass:skin";
const EVENT = "tabi-compass:skin-change";

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

export const skinById = (id: string | undefined) =>
  TABI_SKINS.find((skin) => skin.id === id) ?? TABI_SKINS[0];

export function useTabiSkin(): TabiSkin {
  const id = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => skinById(id), [id]);
}

export function setTabiSkin(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

export function isSkinUnlocked(
  skin: TabiSkin,
  progress: { level: number; completedGoals: Set<string> },
): boolean {
  switch (skin.unlock.kind) {
    case "free":
      return true;
    case "level":
      return progress.level >= skin.unlock.level;
    case "quest":
      return progress.completedGoals.has(`${skin.unlock.eventId}:${skin.unlock.goalId}`);
  }
}

export function unlockLabel(skin: TabiSkin): string {
  switch (skin.unlock.kind) {
    case "free":
      return "はじめから";
    case "level":
      return `Lv.${skin.unlock.level}で解放`;
    case "quest":
      return skin.unlock.label;
  }
}
