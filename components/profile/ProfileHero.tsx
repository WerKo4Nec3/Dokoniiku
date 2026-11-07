"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Pencil, QrCode, Settings, UserPlus, X } from "lucide-react";

// The top of the タビ手帳: the avatar on a coloured banner, the name, the
// friend code and join date, three headline numbers and the friend buttons —
// laid out like a game profile (think Duolingo), so nothing gets squeezed.
export function ProfileHero({
  name,
  bio,
  avatarEmoji,
  avatarColor,
  photoURL,
  levelLabel,
  friendCode,
  joinedLabel,
  stats,
  onEdit,
}: {
  name: string;
  bio?: string;
  avatarEmoji?: string;
  avatarColor: string;
  photoURL?: string | null;
  levelLabel: string;
  friendCode?: string;
  joinedLabel?: string;
  stats: { value: string; label: string; href?: string }[];
  onEdit: () => void;
}) {
  const [showCode, setShowCode] = useState(false);
  const showPhoto = !avatarEmoji && Boolean(photoURL);

  const avatar = (frame: string, emojiSize: string) =>
    showPhoto ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL ?? ""}
        alt=""
        referrerPolicy="no-referrer"
        className={`rounded-full object-cover shadow-float ${frame}`}
      />
    ) : (
      <span
        className={`grid place-items-center rounded-full shadow-float ${frame} ${emojiSize}`}
        style={{ backgroundColor: `color-mix(in srgb, ${avatarColor} 30%, var(--surface))` }}
      >
        {avatarEmoji ?? "🐣"}
      </span>
    );

  return (
    <div className="overflow-clip rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)]">
      {/* Banner: the avatar sits in the middle on phones; on wider screens
          the banner is a strip and the avatar overlaps its lower edge. */}
      <div
        className="relative grid h-52 place-items-center sm:h-32"
        style={{
          background: `radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, ${avatarColor} 55%, transparent), transparent 70%), linear-gradient(160deg, color-mix(in srgb, ${avatarColor} 35%, var(--surface)), color-mix(in srgb, ${avatarColor} 12%, var(--surface)))`,
        }}
      >
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            aria-label="プロフィールを編集"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/40"
          >
            <Pencil size={17} />
          </button>
          <Link
            href="/settings"
            aria-label="設定"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/40"
          >
            <Settings size={17} />
          </Link>
        </div>
        <div className="sm:hidden">{avatar("h-36 w-36 ring-4 ring-white/25", "text-7xl")}</div>
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-7 sm:pt-0">
        <div className="sm:flex sm:items-end sm:gap-5">
          <div className="hidden shrink-0 sm:-mt-14 sm:block">
            {avatar("h-32 w-32 ring-[6px] ring-[color:var(--surface)]", "text-6xl")}
          </div>
          <div className="min-w-0 flex-1 sm:pb-1 sm:pt-4">
            <h2 className="break-words font-display text-[1.75rem] font-bold leading-tight">{name}</h2>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[color:var(--muted)]">
              {friendCode ? `@${friendCode}` : ""}
              {friendCode && joinedLabel ? " ・ " : ""}
              {joinedLabel}
            </p>
            <span
              className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black text-white"
              style={{ backgroundColor: avatarColor }}
            >
              {levelLabel}
            </span>
          </div>
        </div>
        {bio && <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--muted)]">{bio}</p>}

        <div className="mt-5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch sm:gap-3">
          {/* Headline numbers */}
          <div className="grid grid-cols-3 divide-x divide-[color:var(--line)] rounded-2xl border border-[color:var(--line)]">
            {stats.map((stat) => {
              const body = (
                <>
                  <span className="block text-xl font-black tabular-nums">{stat.value}</span>
                  <span className="mt-0.5 block text-[11px] font-bold text-[color:var(--muted)]">{stat.label}</span>
                </>
              );
              return stat.href ? (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="px-2 py-3 text-center transition first:rounded-l-2xl last:rounded-r-2xl hover:bg-[color:var(--surface-muted)]"
                >
                  {body}
                </Link>
              ) : (
                <div key={stat.label} className="px-2 py-3 text-center">
                  {body}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2 sm:mt-0">
            <Link
              href="/friends"
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[color:var(--line)] px-4 py-3 text-sm font-black tracking-wide transition hover:border-vermilion/60 sm:flex-none sm:px-5"
            >
              <UserPlus size={18} />
              なかまを追加
            </Link>
            {friendCode && (
              <button
                type="button"
                onClick={() => setShowCode(true)}
                aria-label="フレンドコードとQR"
                className="grid w-14 shrink-0 place-items-center rounded-2xl border-2 border-[color:var(--line)] text-sky transition hover:border-vermilion/60"
              >
                <QrCode size={22} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showCode && friendCode && (
        <FriendCodeSheet code={friendCode} onClose={() => setShowCode(false)} />
      )}
    </div>
  );
}

// The friend code as text + an invite QR (opens /friends?add=CODE).
function FriendCodeSheet({ code, onClose }: { code: string; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    import("qrcode")
      .then((qr) =>
        qr.toDataURL(`${window.location.origin}/friends?add=${code}`, {
          width: 480,
          margin: 1,
          color: { dark: "#1e1b15", light: "#fefcfa" },
        }),
      )
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [code]);

  async function copy() {
    await navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  // Portalled: the tablet frame may transform, which would trap `fixed`.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="フレンドコード"
      className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/50 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 text-center shadow-float"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black">フレンドコード</h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
          >
            <X size={17} />
          </button>
        </div>
        <div className="mx-auto mt-4 grid aspect-square w-56 place-items-center overflow-hidden rounded-2xl bg-[#fefcfa] p-2">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="なかま申請のQRコード" className="h-full w-full" />
          ) : (
            <span className="text-xs font-bold text-[#1e1b15]/60">QRを作成中…</span>
          )}
        </div>
        <p className="mt-3 text-xs font-medium text-[color:var(--muted)]">
          カメラで読み取ると、あなたになかま申請が届きます。
        </p>
        <button
          type="button"
          onClick={copy}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-5 py-2.5 font-mono text-lg font-black tracking-[0.25em] transition hover:border-vermilion/60"
        >
          {code}
          {copied ? <Check size={16} className="text-forest" /> : <Copy size={16} className="text-[color:var(--muted)]" />}
        </button>
      </div>
    </div>,
    document.body,
  );
}
