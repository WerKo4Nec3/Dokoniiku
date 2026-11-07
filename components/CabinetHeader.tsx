"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { TabiPose } from "@/lib/tabiSkin";

type Accent = "vermilion" | "forest" | "sun" | "sky";

const accentText: Record<Accent, string> = {
  vermilion: "text-vermilion",
  forest: "text-forest dark:text-forest-ink",
  sun: "text-[#8c6702] dark:text-sun",
  sky: "text-[#1b7182] dark:text-sky",
};

// The title line of a かぜOS app. The tablet's status bar already names the
// app, so on phones the title is for screen readers only and the page starts
// right away; wider screens get one slim line. (`mascot` is kept for callers
// but no longer drawn — the big title card took a third of a phone screen.)
export function CabinetHeader({
  eyebrow,
  title,
  subtitle,
  accent = "vermilion",
  backHref,
  backLabel = "もどる",
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  mascot?: TabiPose;
  accent?: Accent;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div>
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="sr-only min-w-0 sm:not-sr-only">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-[0.04em]">
            {title}
            {eyebrow && (
              <span className={`ml-3 align-middle text-[11px] font-black tracking-[0.2em] ${accentText[accent]}`}>
                {eyebrow}
              </span>
            )}
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
