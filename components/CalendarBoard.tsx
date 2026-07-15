"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SavedJourney } from "@/types";
import { placeStatusInfo, statusOf } from "@/lib/utils/travel";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Month calendar showing places the user scheduled a date for.
export function CalendarBoard({
  scheduled,
  onOpen,
}: {
  scheduled: SavedJourney[];
  onOpen: (journey: SavedJourney) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const byDate = useMemo(() => {
    const map = new Map<string, SavedJourney[]>();
    for (const journey of scheduled) {
      if (!journey.plannedDate) continue;
      const list = map.get(journey.plannedDate) ?? [];
      list.push(journey);
      map.set(journey.plannedDate, list);
    }
    return map;
  }, [scheduled]);

  // Grid of dates: leading blanks for the first week, then each day of the month.
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const todayKey = ymd(today);

  return (
    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black">旅のカレンダー</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="前の月"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() - 1, 1),
              )
            }
            className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="w-24 text-center text-xs font-black">
            {cursor.getFullYear()}年 {cursor.getMonth() + 1}月
          </span>
          <button
            type="button"
            aria-label="次の月"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() + 1, 1),
              )
            }
            className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[color:var(--muted)]">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          if (!date) return <div key={`blank-${index}`} className="min-h-14" />;
          const key = ymd(date);
          const items = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`min-h-14 rounded-md border p-1 text-left ${
                isToday
                  ? "border-vermilion/60 bg-vermilion/5"
                  : "border-[color:var(--line)]"
              }`}
            >
              <div
                className={`text-[10px] font-bold ${
                  isToday ? "text-vermilion" : "text-[color:var(--muted)]"
                }`}
              >
                {date.getDate()}
              </div>
              <div className="mt-0.5 space-y-0.5">
                {items.slice(0, 2).map((journey) => {
                  const info = placeStatusInfo[statusOf(journey)];
                  return (
                    <button
                      key={journey.id}
                      type="button"
                      onClick={() => onOpen(journey)}
                      title={journey.destination.name}
                      className={`block w-full truncate rounded px-1 py-0.5 text-left text-[9px] font-bold leading-tight ${info.className}`}
                    >
                      {info.emoji} {journey.destination.name}
                    </button>
                  );
                })}
                {items.length > 2 && (
                  <div className="px-1 text-[9px] font-bold text-[color:var(--muted)]">
                    +{items.length - 2}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {scheduled.length === 0 && (
        <p className="mt-3 text-xs font-medium text-[color:var(--muted)]">
          カードに日付をつけると、ここに予定が並びます。
        </p>
      )}
    </div>
  );
}
