"use client";

import Link from "next/link";
import {
  Bookmark,
  CalendarDays,
  CircleUserRound,
  LogIn,
  LogOut,
  Moon,
  Settings,
  Sun,
  Users,
  UsersRound,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { openAuthDialog } from "@/components/AuthDialog";

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
  const { enabled, loading, user, signOutUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleTheme() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tabi-compass:theme", next ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  async function handleSignOut() {
    setMenuOpen(false);
    await signOutUser();
  }

  return (
    <header className="fixed inset-x-0 top-0 z-[1000] border-b border-black/5 bg-[color:var(--background)]/88 backdrop-blur-xl dark:border-white/10">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          onClick={() => window.dispatchEvent(new Event("dokoniiku:go-home"))}
          className="flex items-center gap-2 font-bold text-[color:var(--foreground)]"
          aria-label="Dokoniiku ホーム"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand-icon.png"
            alt=""
            className="h-9 w-9 rounded-full"
          />
          <span className="hidden sm:inline">Dokoniiku</span>
        </Link>
        <nav className="flex items-center gap-1.5" aria-label="メインナビゲーション">
          {enabled && !loading && !user && (
            <button
              type="button"
              onClick={() => openAuthDialog()}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
            >
              <LogIn size={14} />
              ログイン
            </button>
          )}

          {enabled && user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] text-xs font-black text-[color:var(--foreground)]"
                aria-label="アカウントメニュー"
                aria-expanded={menuOpen}
              >
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  (user.displayName ?? "?").slice(0, 1).toUpperCase()
                )}
              </button>

              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-0 cursor-default"
                  />
                  <div className="absolute right-0 z-10 mt-2 w-52 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] py-1 shadow-float">
                    <p className="truncate px-4 py-2 text-xs font-medium text-[color:var(--muted)]">
                      {user.displayName ?? user.email}
                    </p>
                    <Link
                      href="/saved"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                    >
                      <Bookmark size={16} />
                      保存した旅
                    </Link>
                    <Link
                      href="/calendar"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                    >
                      <CalendarDays size={16} />
                      旅のカレンダー
                    </Link>
                    <Link
                      href="/friends"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                    >
                      <Users size={16} />
                      旅の仲間
                    </Link>
                    <Link
                      href="/groups"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                    >
                      <UsersRound size={16} />
                      グループ
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                    >
                      <CircleUserRound size={16} />
                      プロフィール
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                    >
                      <Settings size={16} />
                      設定
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                    >
                      <LogOut size={16} />
                      ログアウト
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

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
