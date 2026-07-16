"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  CalendarDays,
  CircleUserRound,
  Users,
} from "lucide-react";

const tabs = [
  { href: "/saved", label: "保存した旅", icon: Bookmark },
  { href: "/calendar", label: "カレンダー", icon: CalendarDays },
  { href: "/friends", label: "仲間", icon: Users },
  { href: "/profile", label: "プロフィール", icon: CircleUserRound },
];

// Tab bar shared by every personal-cabinet page.
export function CabinetNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="マイページ"
      className="mt-6 flex gap-1.5 overflow-x-auto pb-1"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition ${
              active
                ? "border-vermilion bg-vermilion text-white"
                : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            }`}
          >
            <Icon size={14} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
