"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bell, BellOff, BellRing, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { disablePush, enablePush, pushStatus, type PushStatus } from "@/lib/push";

// "この端末にも通知": signs this phone/computer up for push notifications
// (invites, requests, chat). Shown in the お知らせ panel and, as a card, in
// settings. Renders nothing where push can't work.
export function PushToggle({ card = false }: { card?: boolean }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    pushStatus(uid)
      .catch((): PushStatus => "unsupported")
      .then((next) => {
        if (alive) setStatus(next);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  if (!uid || !status || status === "unsupported") return null;
  const frame = (content: ReactNode) =>
    card ? (
      <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={16} className="text-sky" />
          <h2 className="text-sm font-black">通知</h2>
        </div>
        {content}
      </div>
    ) : (
      content
    );

  if (status === "install") {
    return frame(
      <p className="flex items-start gap-2.5 rounded-2xl bg-[color:var(--surface-muted)] px-3 py-2.5 text-xs font-bold leading-relaxed text-[color:var(--muted)]">
        <Smartphone size={16} className="mt-0.5 shrink-0 text-sky" aria-hidden />
        <span>
          iPhone では、共有ボタン →「ホーム画面に追加」から開くと、通知を受け取れます。
        </span>
      </p>,
    );
  }

  if (status === "blocked") {
    return frame(
      <p className="flex items-start gap-2.5 rounded-2xl bg-[color:var(--surface-muted)] px-3 py-2.5 text-xs font-bold leading-relaxed text-[color:var(--muted)]">
        <BellOff size={16} className="mt-0.5 shrink-0 text-vermilion" aria-hidden />
        <span>通知がブロックされています。ブラウザのサイト設定で「通知」を許可してください。</span>
      </p>,
    );
  }

  const on = status === "on";
  async function toggle() {
    if (!uid || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      if (on) {
        await disablePush(uid);
        setStatus("off");
      } else {
        setStatus(await enablePush(uid));
      }
    } catch (error) {
      console.error("push:", error);
      setFailed(true);
      setStatus(await pushStatus(uid).catch((): PushStatus => "off"));
    } finally {
      setBusy(false);
    }
  }

  return frame(
    <div className="flex items-center gap-3 rounded-2xl bg-[color:var(--surface-muted)] px-3 py-2.5">
      <span
        aria-hidden
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          on ? "bg-sky text-white" : "bg-[color:var(--surface)] text-[color:var(--muted)]"
        }`}
      >
        <BellRing size={17} strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">この端末にも通知</span>
        {failed ? (
          <span role="alert" className="block text-[11px] font-bold text-vermilion">
            うまく登録できませんでした。もう一度お試しください
          </span>
        ) : (
          <span className="block text-[11px] font-bold text-[color:var(--muted)]">
            {on ? "サイトを閉じていても届きます" : "招待やメッセージをすぐに受け取れます"}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="この端末にも通知"
        aria-busy={busy}
        disabled={busy}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
          on ? "bg-forest" : "bg-[color:var(--line)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>,
  );
}
