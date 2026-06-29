"use client";

import Link from "next/link";
import { Bookmark, Compass, LogOut, Moon, Sun } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

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
  const { enabled, loading, user, signInWithGoogle, signOutUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleTheme() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tabi-compass:theme", next ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  async function handleSignIn() {
    try {
      await signInWithGoogle();
    } catch {
      // popup closed / blocked — nothing to do, user can retry.
    }
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
          className="flex items-center gap-2 font-bold text-[color:var(--foreground)]"
          aria-label="旅コンパス ホーム"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-forest text-white">
            <Compass size={19} strokeWidth={2.4} />
          </span>
          <span className="hidden sm:inline">旅コンパス</span>
        </Link>
        <nav className="flex items-center gap-1.5" aria-label="メインナビゲーション">
          {enabled && !loading && !user && (
            <button
              type="button"
              onClick={handleSignIn}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-3.5 py-2 text-xs font-bold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
            >
              <GoogleMark />
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

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
