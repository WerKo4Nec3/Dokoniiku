"use client";

import { useMemo } from "react";
import { Stamp } from "lucide-react";
import type { SavedJourney } from "@/types";
import { statusOf } from "@/lib/utils/travel";

// A "goshuincho" (stamp book): a red hanko-style seal for every prefecture the
// traveller has completed a place in.
export function PassportStamps({ journeys }: { journeys: SavedJourney[] }) {
  const stamps = useMemo(() => {
    const map = new Map<string, string>();
    for (const journey of journeys) {
      if (statusOf(journey) === "done") {
        map.set(journey.prefecture.id, journey.prefecture.nameJa);
      }
    }
    return [...map.values()];
  }, [journeys]);

  const short = (name: string) => name.replace(/[県府都]$/, "");

  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-black">
          <Stamp size={16} className="text-vermilion" />
          旅の御朱印帳
        </h3>
        <span className="rounded-full bg-vermilion/10 px-2.5 py-1 text-xs font-black text-vermilion tabular-nums">
          {stamps.length}/47
        </span>
      </div>

      {stamps.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-[color:var(--muted)]">
          場所を「完了」にすると、その都道府県の御朱印が押されます。
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {stamps.map((name, i) => (
            <div
              key={name}
              className="grid aspect-square place-items-center rounded-full border-2 border-[#c0392b]/70 bg-[#c0392b]/5"
              style={{ transform: `rotate(${((i % 3) - 1) * 5}deg)` }}
            >
              <span className="px-1 text-center font-display text-xs font-black leading-tight text-[#c0392b] dark:text-[#e57368]">
                {short(name)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
