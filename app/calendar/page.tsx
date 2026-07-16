"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Undo2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useOpenJourney, useUserJourneys } from "@/lib/hooks/cabinet";
import { setJourneyDate } from "@/lib/api/savedJourneys";
import { openAuthDialog } from "@/components/AuthDialog";
import { CabinetNav } from "@/components/CabinetNav";
import type { SavedJourney } from "@/types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type DragState = {
  journey: SavedJourney;
  x: number;
  y: number;
};

export default function CalendarPage() {
  const { enabled, loading, user, journeys, setJourneys } = useUserJourneys();
  const openJourney = useOpenJourney();

  const today = new Date();
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [overRemove, setOverRemove] = useState(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  const byDate = useMemo(() => {
    const map = new Map<string, SavedJourney[]>();
    for (const journey of journeys ?? []) {
      if (!journey.plannedDate) continue;
      const list = map.get(journey.plannedDate) ?? [];
      list.push(journey);
      map.set(journey.plannedDate, list);
    }
    return map;
  }, [journeys]);

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

  async function assignDate(journey: SavedJourney, date: string | null) {
    if (!user) return;
    setJourneys((current) =>
      current
        ? current.map((item) =>
            item.id === journey.id
              ? { ...item, plannedDate: date ?? undefined }
              : item,
          )
        : current,
    );
    await setJourneyDate(user.uid, journey.id, date).catch(() => {});
  }

  // ---- Pointer-based drag & drop (works for mouse and touch alike) ----

  function onDragStart(journey: SavedJourney) {
    return (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      movedRef.current = false;
      startRef.current = { x: event.clientX, y: event.clientY };
      setDrag({ journey, x: event.clientX, y: event.clientY });
    };
  }

  function onDragMove(event: React.PointerEvent<HTMLElement>) {
    if (!drag) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > 6) movedRef.current = true;
    setDrag((current) =>
      current ? { ...current, x: event.clientX, y: event.clientY } : current,
    );
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const cell = under?.closest("[data-drop-date]");
    setHoverDate(cell ? cell.getAttribute("data-drop-date") : null);
    setOverRemove(Boolean(under?.closest("[data-drop-remove]")));
  }

  function onDragEnd(event: React.PointerEvent<HTMLElement>) {
    if (!drag) return;
    const journey = drag.journey;
    const dropDate = hoverDate;
    const remove = overRemove;
    const moved = movedRef.current;
    setDrag(null);
    setHoverDate(null);
    setOverRemove(false);
    if (!moved) {
      // A plain tap opens the card.
      openJourney(journey);
      return;
    }
    if (remove) {
      assignDate(journey, null);
      return;
    }
    if (dropDate && dropDate !== journey.plannedDate) {
      assignDate(journey, dropDate);
    }
    void event;
  }

  const dragHandlers = (journey: SavedJourney) => ({
    onPointerDown: onDragStart(journey),
    onPointerMove: onDragMove,
    onPointerUp: onDragEnd,
    style: { touchAction: "none" as const },
  });

  const todayKey = ymd(today);
  const strip = journeys ?? [];

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-20 pt-24 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <ArrowLeft size={16} />
        旅にもどる
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">旅のカレンダー</h1>
        <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
          下のカードを日付マスへドラッグすると、その日に予定されます。
        </p>
        <CabinetNav />
      </motion.div>

      {!enabled && (
        <p className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
          アカウント機能は現在設定されていません。
        </p>
      )}

      {enabled && !loading && !user && (
        <div className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm font-medium text-[color:var(--muted)]">
            ログインすると、カレンダーが使えます。
          </p>
          <button
            type="button"
            onClick={() => openAuthDialog()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            ログイン / 新規登録
          </button>
        </div>
      )}

      {enabled && user && (
        <div className="mt-8">
          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black">
                {cursor.getFullYear()}年 {cursor.getMonth() + 1}月
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="前の月"
                  onClick={() =>
                    setCursor(
                      (c) => new Date(c.getFullYear(), c.getMonth() - 1, 1),
                    )
                  }
                  className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  aria-label="次の月"
                  onClick={() =>
                    setCursor(
                      (c) => new Date(c.getFullYear(), c.getMonth() + 1, 1),
                    )
                  }
                  className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  <ChevronRight size={17} />
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
                if (!date)
                  return <div key={`blank-${index}`} className="min-h-16 sm:min-h-20" />;
                const key = ymd(date);
                const items = byDate.get(key) ?? [];
                const isToday = key === todayKey;
                const isHover = hoverDate === key && drag;
                return (
                  <div
                    key={key}
                    data-drop-date={key}
                    className={`min-h-16 rounded-md border p-1 transition sm:min-h-20 ${
                      isHover
                        ? "border-vermilion bg-vermilion/10 ring-2 ring-vermilion/40"
                        : isToday
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
                    <div
                      className={`mt-0.5 ${
                        items.length > 1 ? "grid grid-cols-2 gap-0.5" : ""
                      }`}
                    >
                      {items.slice(0, 4).map((journey) => (
                        <div
                          key={journey.id}
                          {...dragHandlers(journey)}
                          title={journey.destination.name}
                          className={`cursor-grab overflow-hidden rounded bg-forest/15 bg-cover bg-center active:cursor-grabbing ${
                            items.length > 1
                              ? "aspect-square"
                              : "aspect-[4/3] w-full"
                          }`}
                          style={{
                            ...(journey.destination.imageUrl
                              ? {
                                  backgroundImage: `url('${journey.destination.imageUrl}')`,
                                }
                              : {}),
                            touchAction: "none",
                          }}
                        >
                          {!journey.destination.imageUrl && (
                            <span className="grid h-full w-full place-items-center text-[10px]">
                              <MapPin size={12} className="text-forest/60" />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {items.length > 4 && (
                      <div className="mt-0.5 text-[9px] font-bold text-[color:var(--muted)]">
                        +{items.length - 4}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Unschedule zone appears while dragging */}
            {drag && (
              <div
                data-drop-remove
                className={`mt-3 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-xs font-bold transition ${
                  overRemove
                    ? "border-vermilion bg-vermilion/10 text-vermilion"
                    : "border-[color:var(--line)] text-[color:var(--muted)]"
                }`}
              >
                <Undo2 size={14} />
                ここにドロップで日付を解除
              </div>
            )}
          </div>

          {/* Draggable saved cards */}
          <div className="mt-6">
            <p className="text-xs font-bold text-[color:var(--muted)]">
              保存した旅（ドラッグして日付へ・タップで開く）
            </p>
            {journeys === null ? (
              <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
                読み込み中…
              </p>
            ) : strip.length === 0 ? (
              <p className="mt-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5 text-sm font-medium text-[color:var(--muted)]">
                まだ保存された旅がありません。ホームで行き先を見つけてみよう。
              </p>
            ) : (
              <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
                {strip.map((journey) => (
                  <div
                    key={journey.id}
                    {...dragHandlers(journey)}
                    className="w-24 shrink-0 cursor-grab select-none active:cursor-grabbing"
                  >
                    <div
                      className="aspect-square w-full overflow-hidden rounded-lg border border-[color:var(--line)] bg-forest/10 bg-cover bg-center shadow-sm"
                      style={
                        journey.destination.imageUrl
                          ? {
                              backgroundImage: `url('${journey.destination.imageUrl}')`,
                            }
                          : undefined
                      }
                    >
                      {!journey.destination.imageUrl && (
                        <span className="grid h-full w-full place-items-center text-forest/50">
                          <MapPin size={22} />
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[10px] font-bold">
                      {journey.destination.name}
                    </p>
                    {journey.plannedDate && (
                      <p className="text-[9px] font-bold text-vermilion">
                        {journey.plannedDate.slice(5).replace("-", "/")} 予定
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drag ghost */}
          {drag && (
            <div
              className="pointer-events-none fixed z-[3000] h-16 w-16 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border-2 border-white bg-forest/20 bg-cover bg-center shadow-xl"
              style={{
                left: drag.x,
                top: drag.y,
                ...(drag.journey.destination.imageUrl
                  ? {
                      backgroundImage: `url('${drag.journey.destination.imageUrl}')`,
                    }
                  : {}),
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}
