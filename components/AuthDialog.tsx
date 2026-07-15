"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

export const OPEN_AUTH_EVENT = "dokoniiku:open-auth";

// Anywhere can pop the auth dialog by dispatching this event.
export function openAuthDialog() {
  window.dispatchEvent(new Event(OPEN_AUTH_EVENT));
}

type Mode = "login" | "register";

// Firebase auth error codes → friendly Japanese messages.
function messageFor(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません。";
    case "auth/email-already-in-use":
      return "このメールアドレスは登録済みです。ログインしてね。";
    case "auth/weak-password":
      return "パスワードは6文字以上にしてください。";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "メールアドレスかパスワードが違います。";
    case "auth/too-many-requests":
      return "試行回数が多すぎます。少し待ってからもう一度。";
    case "auth/operation-not-allowed":
      return "メール認証が有効になっていません（Firebase設定を確認）。";
    default:
      return "うまくいきませんでした。もう一度お試しください。";
  }
}

export function AuthDialog() {
  const { enabled, user, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onOpen() {
      setError(null);
      setOpen(true);
    }
    window.addEventListener(OPEN_AUTH_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AUTH_EVENT, onOpen);
  }, []);

  // Close automatically once the user is signed in.
  useEffect(() => {
    if (user) setOpen(false);
  }, [user]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled || !open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
      // The user effect closes the dialog on success.
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      // popup closed / blocked — let the user retry.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "login" ? "ログイン" : "新規登録"}
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-float">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="閉じる"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
        >
          <X size={18} />
        </button>

        <div className="mb-5 inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded-full px-4 py-1.5 transition ${
              mode === "login"
                ? "bg-vermilion text-white"
                : "text-[color:var(--muted)]"
            }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`rounded-full px-4 py-1.5 transition ${
              mode === "register"
                ? "bg-vermilion text-white"
                : "text-[color:var(--muted)]"
            }`}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ニックネーム（旅人名）"
              autoComplete="nickname"
              className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-2.5 text-sm font-medium outline-none focus:border-vermilion"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            autoComplete="email"
            className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-2.5 text-sm font-medium outline-none focus:border-vermilion"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード（6文字以上）"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-2.5 text-sm font-medium outline-none focus:border-vermilion"
          />

          {error && (
            <p className="text-xs font-bold text-vermilion">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-vermilion px-4 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy
              ? "処理中…"
              : mode === "login"
                ? "ログイン"
                : "アカウントを作成"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[11px] font-bold text-[color:var(--muted)]">
          <span className="h-px flex-1 bg-[color:var(--line)]" />
          または
          <span className="h-px flex-1 bg-[color:var(--line)]" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2.5 text-sm font-bold transition hover:bg-[color:var(--surface-muted)] disabled:opacity-60"
        >
          <GoogleMark />
          Googleで続ける
        </button>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
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
