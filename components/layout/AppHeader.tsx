"use client";

import Link from "next/link";
import { Compass, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const THEME_EVENT = "tabi-compass:theme-change";

function subscribeTheme(listener: () => void) {
  window.addEventListener(THEME_EVENT, listener);
  return () => window.removeEventListener(THEME_EVENT, listener);
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

export function AppHeader() {
  const isDark = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => false,
  );

  function toggleTheme() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tabi-compass:theme", next ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <header className="fixed inset-x-0 top-0 z-[1000] border-b border-black/5 bg-[color:var(--background)]/88 backdrop-blur-xl dark:border-white/10">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-[color:var(--foreground)]"
          aria-label="旅コンパス ホーム"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-forest text-white">
            <Compass size={19} strokeWidth={2.4} />
          </span>
          <span className="hidden sm:inline">旅コンパス</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="メインナビゲーション">
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={isDark ? "ライトモードに切り替える" : "ダークモードに切り替える"}
            title={isDark ? "ライトモード" : "ダークモード"}
          >
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </nav>
      </div>
    </header>
  );
}
