"use client";

import { useSyncExternalStore } from "react";
import type { TabiApp } from "./apps";

const SIZES = {
  sm: { box: "h-10 w-10 rounded-[12px]", icon: 19 },
  md: { box: "h-14 w-14 rounded-[17px]", icon: 26 },
  lg: { box: "h-16 w-16 rounded-[20px]", icon: 30 },
} as const;

// A かぜOS app tile: gradient squircle with a soft top gloss.
export function AppIcon({ app, size = "md" }: { app: TabiApp; size?: keyof typeof SIZES }) {
  const Icon = app.icon;
  const s = SIZES[size];
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden text-white shadow-[0_6px_14px_-6px_rgb(0_0_0_/_0.45)] ${s.box}`}
      style={{ background: `linear-gradient(150deg, ${app.from}, ${app.to})` }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent"
      />
      <Icon size={s.icon} strokeWidth={2.2} className="relative drop-shadow-sm" />
    </span>
  );
}

// Minute-resolution clock for the status bar / home screen (client only,
// so the server render shows nothing instead of a mismatched time).
function subscribeClock(onTick: () => void) {
  const id = window.setInterval(onTick, 15000);
  return () => window.clearInterval(id);
}
const clockSnapshot = () => {
  const now = new Date();
  return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
};
export function useClock(): string {
  return useSyncExternalStore(subscribeClock, clockSnapshot, () => "");
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const dateSnapshot = () => {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日（${WEEKDAYS[now.getDay()]}）`;
};
export function useToday(): string {
  return useSyncExternalStore(subscribeClock, dateSnapshot, () => "");
}
