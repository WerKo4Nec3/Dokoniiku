"use client";

import { useState } from "react";
import { Check, Link2, Pencil, X } from "lucide-react";
import type { TabibitoProfile } from "@/types";
import { saveProfile } from "@/lib/api/profile";

const AVATAR_EMOJI = ["🐣", "🧭", "🗺️", "⛰️", "🏯", "🌊", "🚃", "🍜"];
const AVATAR_COLORS = [
  "#285f4d",
  "#e8583e",
  "#3a86a8",
  "#7c5cff",
  "#e8863e",
  "#c2603a",
];

// Traveller ("tabibito") rank derived from how many places the user has done.
function levelFor(visited: number): { title: string; level: number } {
  const level = Math.floor(visited / 3) + 1;
  const title =
    visited >= 30
      ? "伝説の旅人"
      : visited >= 15
        ? "旅の達人"
        : visited >= 5
          ? "熟練の旅人"
          : visited >= 1
            ? "駆け出し旅人"
            : "みならい旅人";
  return { title, level };
}

export function ProfileCard({
  uid,
  profile,
  authName,
  photoURL,
  hasGoogle,
  visitedCount,
  onSaved,
  onLinkGoogle,
}: {
  uid: string;
  profile: TabibitoProfile | null;
  // Name/photo arriving from the auth provider (Google) — empty for
  // email/password accounts until the user fills the profile in.
  authName?: string | null;
  photoURL?: string | null;
  hasGoogle: boolean;
  visitedCount: number;
  onSaved: (profile: TabibitoProfile) => void;
  onLinkGoogle?: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [name, setName] = useState(profile?.displayName ?? authName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [emoji, setEmoji] = useState(profile?.avatarEmoji ?? "");
  const [color, setColor] = useState(profile?.avatarColor ?? AVATAR_COLORS[0]);

  const displayName = profile?.displayName?.trim() || authName?.trim() || "旅人";
  const avatarColor = profile?.avatarColor ?? AVATAR_COLORS[0];
  // A chosen emoji wins; otherwise the Google photo; otherwise the chick.
  const avatarEmoji = profile?.avatarEmoji;
  const showPhoto = !avatarEmoji && Boolean(photoURL);
  const rank = levelFor(visitedCount);

  async function handleSave() {
    setBusy(true);
    const next: TabibitoProfile = {
      displayName: name.trim() || undefined,
      bio: bio.trim() || undefined,
      avatarEmoji: emoji || undefined,
      avatarColor: color,
    };
    try {
      await saveProfile(uid, next);
      onSaved(next);
      setEditing(false);
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
        code === "auth/credential-already-in-use" ||
          code === "auth/email-already-in-use"
          ? "このGoogleアカウントは別のユーザーに連携済みです。"
          : "連携できませんでした。もう一度お試しください。",
      );
    } finally {
      setLinkBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black">プロフィールを編集</h2>
          <button
            type="button"
            aria-label="キャンセル"
            onClick={() => setEditing(false)}
            className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
          >
            <X size={16} />
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
              className={`h-9 w-9 overflow-hidden rounded-full border transition ${
                emoji === ""
                  ? "border-vermilion ring-2 ring-vermilion/30"
                  : "border-[color:var(--line)]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoURL}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </button>
          )}
          {AVATAR_EMOJI.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEmoji(option)}
              className={`grid h-9 w-9 place-items-center rounded-full border text-lg transition ${
                emoji === option
                  ? "border-vermilion ring-2 ring-vermilion/30"
                  : "border-[color:var(--line)]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {AVATAR_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`色 ${option}`}
              onClick={() => setColor(option)}
              style={{ backgroundColor: option }}
              className={`h-7 w-7 rounded-full transition ${
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
          className="mt-4 w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-2.5 text-sm font-medium outline-none focus:border-vermilion"
        />
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="ひとことプロフィール（好きな旅など）"
          maxLength={120}
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-2.5 text-sm font-medium outline-none focus:border-vermilion"
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-vermilion px-4 py-2 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <Check size={14} />
            保存
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
      <div className="flex items-center gap-4">
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoURL ?? ""}
            alt=""
            referrerPolicy="no-referrer"
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-3xl"
            style={{ backgroundColor: `${avatarColor}22` }}
          >
            {avatarEmoji ?? "🐣"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-black">{displayName}</h2>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black text-white"
              style={{ backgroundColor: avatarColor }}
            >
              Lv.{rank.level} {rank.title}
            </span>
          </div>
          {profile?.bio ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium text-[color:var(--muted)]">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
              完了した場所の数で旅人ランクが上がります。
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="プロフィールを編集"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--line)] text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
        >
          <Pencil size={15} />
        </button>
      </div>

      {/* Account linking for email/password users. */}
      {!hasGoogle && onLinkGoogle && (
        <div className="mt-4 border-t border-[color:var(--line)] pt-3">
          <button
            type="button"
            onClick={handleLink}
            disabled={linkBusy}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] disabled:opacity-60"
          >
            <Link2 size={14} />
            {linkBusy ? "連携中…" : "Googleアカウントを連携する"}
          </button>
          {linkError && (
            <p className="mt-2 text-xs font-bold text-vermilion">{linkError}</p>
          )}
        </div>
      )}
    </div>
  );
}
