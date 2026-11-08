"use client";

import { memo, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { CATEGORY_ORDER, CategoryCard } from "@/components/journey/CategoryCard";
import type { DestinationCategory } from "@/types";

// 「ジャンルで絞る」 on the prefecture stage. Opening and closing is local
// state, so it re-renders this panel only, not the whole journey screen
// (that took a visible moment on phones). The cards stay mounted while
// closed, so opening is just a show; it fades in with CSS, closes at once.
export const GenreFilter = memo(function GenreFilter({
  selected,
  onToggle,
  onReset,
  openRequest,
}: {
  selected: DestinationCategory[];
  onToggle: (category: DestinationCategory) => void;
  onReset: () => void;
  // Bumped by the screen to open the panel (e.g. nothing matched the genres).
  openRequest: number;
}) {
  const [open, setOpen] = useState(false);
  const [seenRequest, setSeenRequest] = useState(openRequest);
  if (openRequest !== seenRequest) {
    setSeenRequest(openRequest);
    setOpen(true);
  }

  return (
    <div className="mt-6 border-t border-[color:var(--line)] pt-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="btn-3d btn-3d-plain btn-3d-sm"
      >
        <SlidersHorizontal size={14} />
        ジャンルで絞る（任意）
        {selected.length > 0 && (
          <span className="rounded-full bg-vermilion px-1.5 py-0.5 text-[10px] font-black text-white">
            {selected.length}件
          </span>
        )}
      </button>

      <div hidden={!open} className="panel-in">
        <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--foreground)]">気になるジャンル</p>
              <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)]">
                複数選択できます・未選択ならタビにおまかせ
              </p>
            </div>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
              >
                <RotateCcw size={12} />
                クリア
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CATEGORY_ORDER.map((category) => (
              <CategoryCard
                key={category}
                category={category}
                selected={selected.includes(category)}
                onClick={() => onToggle(category)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
