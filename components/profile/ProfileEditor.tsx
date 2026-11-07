"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Link2, X } from "lucide-react";
import { saveProfile } from "@/lib/api/profile";
import type { TabibitoProfile } from "@/types";

export const AVATAR_EMOJI = ["🐣", "🧭", "🗺️", "⛰️", "🏯", "🌊", "🚃", "🍜", "🚲", "♨️"];
export const AVATAR_COLORS = ["#285f4d", "#e8583e", "#3a86a8", "#7c5cff", "#e8863e", "#c2603a"];

// Edit name / bio / avatar in a sheet over the profile.
export function ProfileEditor({
  uid,
  profile,
  authName,
  photoURL,
  hasGoogle,
  onSaved,
  onClose,
  onLinkGoogle,
}: {
  uid: string;
  profile: TabibitoProfile | null;
  authName?: string | null;
  photoURL?: string | null;
  hasGoogle: boolean;
  onSaved: (profile: TabibitoProfile) => void;
  onClose: () => void;
  onLinkGoogle?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(profile?.displayName ?? authName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [emoji, setEmoji] = useState(profile?.avatarEmoji ?? "");
  const [color, setColor] = useState(profile?.avatarColor ?? AVATAR_COLORS[0]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    const next: TabibitoProfile = {
      ...profile,
      displayName: name.trim() || undefined,
      bio: bio.trim() || undefined,
      avatarEmoji: emoji || undefined,
      avatarColor: color,
    };
    try {
      await saveProfile(uid, next);
      onSaved(next);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleLink() {
    if (!onLinkGoogle) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      await onLinkGoogle();
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      setLinkError(
        code === "auth/credential-already-in-use" || code === "auth/email-already-in-use"
          ? "このGoogleアカウントは別のユーザーに連携済みです。"
          : "連携できませんでした。もう一度お試しください。",
      );
    } finally {
      setLinkBusy(false);
    }
  }

  // Portalled: the tablet frame may transform, which would trap `fixed`.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="プロフィールを編集"
      className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/50 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-float"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black">プロフィールを編集</h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
          >
            <X size={17} />
          </button>
        </div>

        <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
          アイコン{photoURL ? "（未選択ならGoogleの写真）" : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {photoURL && (
            <button
              type="button"
              onClick={() => setEmoji("")}
              aria-label="Googleの写真を使う"
              className={`h-10 w-10 overflow-hidden rounded-full border transition ${
                emoji === "" ? "border-vermilion ring-2 ring-vermilion/30" : "border-[color:var(--line)]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            </button>
          )}
          {AVATAR_EMOJI.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEmoji(option)}
              className={`grid h-10 w-10 place-items-center rounded-full border text-xl transition ${
                emoji === option ? "border-vermilion ring-2 ring-vermilion/30" : "border-[color:var(--line)]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">背景の色</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {AVATAR_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`色 ${option}`}
              onClick={() => setColor(option)}
              style={{ backgroundColor: option }}
              className={`h-8 w-8 rounded-full transition ${
                color === option
                  ? "ring-2 ring-[color:var(--foreground)] ring-offset-2 ring-offset-[color:var(--surface)]"
                  : ""
              }`}
            />
          ))}
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="旅人名（ニックネーム）"
          maxLength={24}
          className="mt-5 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-3 text-sm font-medium outline-none focus:border-vermilion"
        />
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="ひとことプロフィール（好きな旅など）"
          maxLength={120}
          rows={2}
          className="mt-2 w-full resize-none rounded-xl border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-3 text-sm font-medium outline-none focus:border-vermilion"
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-vermilion px-4 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <Check size={16} />
          保存する
        </button>

        {/* Account linking for email/password users. */}
        {!hasGoogle && onLinkGoogle && (
          <div className="mt-4 border-t border-[color:var(--line)] pt-4">
            <button
              type="button"
              onClick={handleLink}
              disabled={linkBusy}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] disabled:opacity-60"
            >
              <Link2 size={14} />
              {linkBusy ? "連携中…" : "Googleアカウントを連携する"}
            </button>
            {linkError && <p className="mt-2 text-xs font-bold text-vermilion">{linkError}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
