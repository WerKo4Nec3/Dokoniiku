"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppIcon } from "@/components/tabi-os/AppIcon";
import { appForPath } from "@/components/tabi-os/apps";
import { TabiSprite } from "@/features/mascot/TabiSprite";
import type { TabiPose } from "@/lib/tabiSkin";

type Accent = "vermilion" | "forest" | "sun" | "sky";

const accentText: Record<Accent, string> = {
  vermilion: "text-vermilion",
  forest: "text-forest dark:text-forest-ink",
  sun: "text-[#8c6702] dark:text-sun",
  sky: "text-[#1b7182] dark:text-sky",
};
const accentHalo: Record<Accent, string> = {
  vermilion: "bg-vermilion/15",
  forest: "bg-forest/15",
  sun: "bg-sun/20",
  sky: "bg-sky/20",
};

// The title bar of a かぜOS app: the app's icon, eyebrow + title +
// subtitle, and Tabi (in the chosen skin) on the side. The OS dock handles
// navigation, so a back link only shows when a page asks for one.
export function CabinetHeader({
  eyebrow,
  title,
  subtitle,
  mascot,
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
  const pathname = usePathname();
  const app = appForPath(pathname);
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

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-clip rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-5 shadow-float sm:px-7 sm:py-6"
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full blur-2xl ${accentHalo[accent]}`}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {app && (
              <span className="hidden sm:block">
                <AppIcon app={app} size="lg" />
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <span className={`text-[11px] font-black tracking-[0.25em] ${accentText[accent]}`}>
                  {eyebrow}
                </span>
              )}
              <h1 className="mt-1 font-display text-3xl font-bold leading-tight tracking-[0.04em] sm:text-4xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-xl text-sm font-medium text-[color:var(--muted)]">
                  {subtitle}
                </p>
              )}
              {action && <div className="mt-4">{action}</div>}
            </div>
          </div>

          {mascot && (
            <TabiSprite
              pose={mascot}
              className="hidden aspect-[538/422] w-28 shrink-0 sm:block"
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
