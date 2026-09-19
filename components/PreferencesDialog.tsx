"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { categoryLabels } from "@/lib/utils/travel";
import type { DestinationCategory } from "@/types";
import {
  CATEGORY_EMOJI,
  PREFERENCE_CATEGORIES,
  PREFERENCES_OPEN_EVENT,
  hasOnboarded,
  markOnboarded,
  readPreferences,
  writePreferences,
} from "@/lib/preferences";

// First-run onboarding + later editing of the traveller's favourite genres.
// Auto-opens once on the home page; also opens on the open-preferences event
// (from the settings page). Purely local — no account needed.
export function PreferencesDialog() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<DestinationCategory>>(new Set());

  // Load current picks and auto-open for first-time visitors on the home page.
  useEffect(() => {
    setSelected(new Set(readPreferences()));
    if (
      !hasOnboarded() &&
      typeof window !== "undefined" &&
      window.location.pathname === "/"
    ) {
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    function onOpen() {
      setSelected(new Set(readPreferences()));
      setOpen(true);
    }
    window.addEventListener(PREFERENCES_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PREFERENCES_OPEN_EVENT, onOpen);
  }, []);

  function toggle(category: DestinationCategory) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function save() {
    writePreferences([...selected]);
    markOnboarded();
    setOpen(false);
  }

  function skip() {
    markOnboarded();
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="好みのジャンル"
        >
          <button
            type="button"
            aria-label="閉じる"
            onClick={skip}
            className="fixed inset-0 cursor-default bg-black/55 backdrop-blur-sm"
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] shadow-float"
            >
              <div className="relative bg-gradient-to-b from-vermilion/15 via-vermilion/5 to-transparent px-6 pt-6 text-center">
                <button
                  type="button"
                  onClick={skip}
                  aria-label="閉じる"
                  className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  <X size={18} />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/mascot/waving.png"
                  alt=""
                  className="mx-auto h-20 w-auto drop-shadow-md"
                />
                <h2 className="mt-2 text-lg font-black">好きな旅は、どれ？</h2>
                <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                  選んでおくと、タビが行き先をあなた好みに寄せて選びます。
                  <br />
                  あとで設定からいつでも変えられます。
                </p>
              </div>

              <div className="px-6 pb-6 pt-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PREFERENCE_CATEGORIES.map((category) => {
                    const active = selected.has(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggle(category)}
                        aria-pressed={active}
                        className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${
                          active
                            ? "border-vermilion bg-vermilion/10 text-vermilion"
                            : "border-[color:var(--line)] text-[color:var(--foreground)] hover:border-vermilion/40"
                        }`}
                      >
                        <span aria-hidden className="text-lg">
                          {CATEGORY_EMOJI[category]}
                        </span>
                        {categoryLabels[category]}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={skip}
                    className="text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
                  >
                    スキップ
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    className="rounded-full bg-vermilion px-6 py-2.5 text-sm font-black text-white shadow-sm shadow-vermilion/30 transition hover:opacity-90"
                  >
                    {selected.size ? "これで決定" : "おまかせにする"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
