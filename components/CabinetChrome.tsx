"use client";

import { usePathname } from "next/navigation";
import { CabinetNav, isCabinetPath } from "@/components/CabinetNav";

// Rendered once in the root layout. Fixed under the 64px AppHeader; shows only
// on cabinet routes. Because it never unmounts while moving between tabs, the
// CabinetNav layoutId pill animates across navigations.
export function CabinetChrome() {
  const pathname = usePathname();
  if (!isCabinetPath(pathname)) return null;

  return (
    <div className="fixed inset-x-0 top-16 z-40 border-b border-black/5 bg-[color:var(--background)]/80 backdrop-blur-xl dark:border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-2.5 sm:px-6">
        <CabinetNav />
      </div>
    </div>
  );
}
