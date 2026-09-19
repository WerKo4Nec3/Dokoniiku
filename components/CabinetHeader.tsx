"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type Mascot = "waving" | "pointing" | "map" | "camera" | "walking";
type Accent = "vermilion" | "forest" | "sun" | "sky";

const accentText: Record<Accent, string> = {
  vermilion: "text-vermilion",
  forest: "text-forest dark:text-[#8fd0b9]",
  sun: "text-[#b98a12] dark:text-sun",
  sky: "text-[#3f8ea0] dark:text-sky",
};
const accentBar: Record<Accent, string> = {
  vermilion: "bg-vermilion",
  forest: "bg-forest",
  sun: "bg-sun",
  sky: "bg-sky",
};
const accentHalo: Record<Accent, string> = {
  vermilion: "bg-vermilion/15",
  forest: "bg-forest/15",
  sun: "bg-sun/20",
  sky: "bg-sky/20",
};

// Reusable hero/section header for every cabinet page: eyebrow + title +
// subtitle, a soft accent wash, and an optional mascot.
export function CabinetHeader({
  eyebrow,
  title,
  subtitle,
  mascot,
  accent = "vermilion",
  backHref = "/",
  backLabel = "旅にもどる",
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  mascot?: Mascot;
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
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </Link>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-4 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-6 shadow-float sm:px-7 sm:py-8"
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full blur-2xl ${accentHalo[accent]}`}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <span
                className={`inline-flex items-center gap-2 text-xs font-black tracking-wide ${accentText[accent]}`}
              >
                <span className={`h-3 w-1 rounded-full ${accentBar[accent]}`} />
                {eyebrow}
              </span>
            )}
            <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 max-w-xl text-sm font-medium text-[color:var(--muted)]">
                {subtitle}
              </p>
            )}
            {action && <div className="mt-4">{action}</div>}
          </div>

          {mascot && (
            <div className="relative hidden shrink-0 sm:block">
              <div
                aria-hidden
                className={`absolute inset-0 scale-125 rounded-full blur-xl ${accentHalo[accent]}`}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/mascot/${mascot}.png`}
                alt=""
                className="relative h-20 w-20 object-contain drop-shadow sm:h-24 sm:w-24"
              />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
