"use client";

import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { BatteryMedium, LayoutGrid, Radio, Wifi, Wind } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useLiveShare } from "@/lib/live";
import { AppIcon, useClock } from "./AppIcon";
import { OS_HOME, TABI_APPS, appForPath, isOSPath } from "./apps";

// Tabi's tablet: a bezel drawn over the page (the page still scrolls
// normally underneath, so every feature keeps working), a status bar and an
// app dock. Rendered once in the root layout; only shows on OS pages.
export function TabiOSFrame() {
  const pathname = usePathname();
  const on = isOSPath(pathname);
  const app = appForPath(pathname);
  const clock = useClock();
  const sharing = useLiveShare();
  const reduce = useReducedMotion();

  useEffect(() => {
    const root = document.documentElement;
    if (on) root.dataset.os = "on";
    else delete root.dataset.os;
    return () => {
      delete root.dataset.os;
    };
  }, [on]);

  if (!on) return null;
  const home = pathname === OS_HOME;
  const dockApps = TABI_APPS.filter((item) => !item.adminOnly);

  return (
    <>
      <div aria-hidden className="os-bezel">
        <span className="os-camera" />
      </div>

      <div className="os-statusbar">
        <Link
          href={OS_HOME}
          className="inline-flex min-w-0 items-center gap-1.5 text-xs font-black tracking-wide"
        >
          <Wind size={14} className="shrink-0 text-vermilion" />
          <span className="shrink-0">かぜOS</span>
          {app && !home && (
            <span className="truncate font-bold text-[color:var(--muted)]">・{app.name}</span>
          )}
        </Link>
        <span className="flex items-center gap-2 text-[11px] font-bold tabular-nums">
          {sharing && (
            <Link
              href="/live"
              className="inline-flex items-center gap-1 rounded-full bg-vermilion px-2 py-0.5 text-[10px] font-black text-white"
            >
              <Radio size={11} className="animate-pulse" /> 共有中
            </Link>
          )}
          <span className="hidden sm:inline">{clock}</span>
          <Wifi size={13} className="hidden sm:block" />
          <BatteryMedium size={16} className="hidden sm:block" />
        </span>
      </div>

      <nav aria-label="タビパッド" className="os-dock">
        <LayoutGroup id="os-dock">
          <Link
            href={OS_HOME}
            aria-label="ホーム"
            aria-current={home ? "page" : undefined}
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[color:var(--foreground)] text-[color:var(--background)] sm:h-12 sm:w-12"
          >
            <LayoutGrid size={20} />
            {home && <DockDot reduce={reduce} />}
          </Link>
          <span aria-hidden className="mx-1 h-8 w-px shrink-0 bg-[color:var(--line)]" />
          {dockApps.map((item) => {
            const active = app?.id === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.name}
                aria-current={active ? "page" : undefined}
                className={`group relative shrink-0 transition-transform hover:-translate-y-1 ${
                  item.dock ? "" : "hidden md:block"
                }`}
              >
                <AppIcon app={item} size="sm" />
                <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-[color:var(--foreground)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--background)] opacity-0 transition group-hover:opacity-100 md:block">
                  {item.name}
                </span>
                {active && <DockDot reduce={reduce} />}
              </Link>
            );
          })}
        </LayoutGroup>
      </nav>
    </>
  );
}

function DockDot({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.span
      layoutId="os-dock-dot"
      className="absolute -bottom-2 left-0 right-0 mx-auto h-1 w-1 rounded-full bg-[color:var(--foreground)]"
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 35 }}
    />
  );
}
