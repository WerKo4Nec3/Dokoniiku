"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PlaceStatus } from "@/types";
import { placeStatusInfo, placeStatusOrder } from "@/lib/utils/travel";

// Compact dropdown to move a place through the status pipeline.
export function StatusPicker({
  status,
  onChange,
}: {
  status: PlaceStatus;
  onChange: (next: PlaceStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const info = placeStatusInfo[status];

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${info.className}`}
      >
        <span aria-hidden>{info.emoji}</span>
        {info.labelJa}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] py-1 shadow-float"
        >
          {placeStatusOrder.map((option) => {
            const optionInfo = placeStatusInfo[option];
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === status}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-bold transition hover:bg-[color:var(--surface-muted)] ${
                  option === status
                    ? "text-[color:var(--foreground)]"
                    : "text-[color:var(--muted)]"
                }`}
              >
                <span aria-hidden>{optionInfo.emoji}</span>
                {optionInfo.labelJa}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
