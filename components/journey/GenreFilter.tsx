"use client";

import { memo, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { CATEGORY_ORDER, CategoryCard } from "@/components/journey/CategoryCard";
import { categoryLabels } from "@/lib/utils/travel";
import type { DestinationCategory } from "@/types";

const subscribeNothing = () => () => {};

const sameGenres = (a: DestinationCategory[], b: DestinationCategory[]) =>
  a.length === b.length && a.every((genre) => b.includes(genre));

// 「ジャンルで絞る」 on the prefecture stage, as a sheet that slides up over
// the page. Opening it inline grew the frosted card (Japan map, seven
// painted cards), so phones had to lay out and repaint the page on every
// open. The sheet is always rendered, parked just below the screen on its
// own layer, so opening only moves it. Picks stay in the sheet until it
// closes, so a tap re-renders the seven cards and not the journey screen.
export const GenreFilter = memo(function GenreFilter({
  selected,
  onApply,
  openRequest,
}: {
  selected: DestinationCategory[];
  onApply: (genres: DestinationCategory[]) => void;
  // Bumped by the screen to open the sheet (e.g. nothing matched the genres).
  openRequest: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(selected);
  const [seenRequest, setSeenRequest] = useState(openRequest);
  if (openRequest !== seenRequest) {
    setSeenRequest(openRequest);
    setDraft(selected);
    setOpen(true);
  }
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);

  function show() {
    setDraft(selected);
    setOpen(true);
  }

  // Picks are handed to the screen once the sheet goes away.
  function close() {
    setOpen(false);
    if (!sameGenres(draft, selected)) onApply(draft);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      if (!sameGenres(draft, selected)) onApply(draft);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, draft, selected, onApply]);

  function toggle(genre: DestinationCategory) {
    setDraft((current) =>
      current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre],
    );
  }

  const chosen = selected.map((genre) => categoryLabels[genre]).join("・");

  return (
    <div className="mt-6 border-t border-[color:var(--line)] pt-6">
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="btn-3d btn-3d-plain btn-3d-sm max-w-full"
      >
        <SlidersHorizontal size={14} className="shrink-0" />
        {selected.length ? (
          <span className="truncate">ジャンル：{chosen}</span>
        ) : (
          "ジャンルで絞る（任意）"
        )}
      </button>

      {isClient &&
        createPortal(
          // Portalled: the tablet frame may transform, which would trap `fixed`.
          <div
            className="pointer-events-none fixed inset-0 z-[1300] flex items-end justify-center sm:items-center sm:p-6"
            inert={!open}
            aria-hidden={!open}
          >
            <div
              onClick={close}
              className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${
                open ? "pointer-events-auto opacity-100" : "opacity-0"
              }`}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="気になるジャンル"
              className={`relative max-h-[88svh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-float transition-[transform,opacity] duration-200 ease-out will-change-transform sm:max-w-xl sm:rounded-[28px] sm:p-6 ${
                open
                  ? "pointer-events-auto translate-y-0 sm:opacity-100"
                  : // Parked below the screen, shadow and all.
                    "translate-y-[calc(100%+3rem)] sm:translate-y-6 sm:opacity-0"
              }`}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[color:var(--line)] sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black">気になるジャンル</h2>
                  <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)]">
                    複数選択できます・未選択ならタビにおまかせ
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="閉じる"
                  onClick={close}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
                {CATEGORY_ORDER.map((genre) => (
                  <CategoryCard
                    key={genre}
                    category={genre}
                    selected={draft.includes(genre)}
                    onClick={() => toggle(genre)}
                  />
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  disabled={!draft.length}
                  className="btn-3d btn-3d-plain px-4"
                >
                  <RotateCcw size={15} />
                  クリア
                </button>
                <button type="button" onClick={close} className="btn-3d flex-1">
                  {draft.length ? `${draft.length}ジャンルで決定` : "おまかせにする"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});
