"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Bookmark,
  CalendarDays,
  CircleUserRound,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type CabinetTab = {
  href: string;
  label: string; // full label, sm+ screens
  short: string; // compact label, <sm screens
  icon: LucideIcon;
};

export const cabinetTabs: CabinetTab[] = [
  { href: "/saved", label: "保存した旅", short: "保存", icon: Bookmark },
  { href: "/calendar", label: "カレンダー", short: "予定", icon: CalendarDays },
  { href: "/friends", label: "仲間", short: "仲間", icon: Users },
  { href: "/groups", label: "グループ", short: "グループ", icon: UsersRound },
  { href: "/profile", label: "プロフィール", short: "自分", icon: CircleUserRound },
  { href: "/settings", label: "設定", short: "設定", icon: Settings },
];

// Keeps /groups active on /groups/[id].
const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/");

export const isCabinetPath = (pathname: string) =>
  cabinetTabs.some((tab) => isActive(pathname, tab.href));

// Pure segmented control. Positioning/backdrop is the caller's job.
export function CabinetNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="マイページ"
      className="no-scrollbar mx-auto flex max-w-2xl snap-x snap-mandatory items-center gap-1 overflow-x-auto rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] p-1 shadow-float sm:justify-center"
    >
      <LayoutGroup id="cabinet-nav">
        {cabinetTabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors sm:px-4 ${
                active
                  ? "text-white"
                  : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="cabinet-active-pill"
                  className="absolute inset-0 rounded-full bg-vermilion shadow-sm"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }
                  }
                />
              )}
              <Icon size={15} className="relative z-10 shrink-0" />
              <span className="relative z-10 whitespace-nowrap">
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </span>
            </Link>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}
