"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
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
  fallbackName,
  visitedCount,
  onSaved,
}: {
  uid: string;
  profile: TabibitoProfile | null;
  fallbackName: string;
  visitedCount: number;
  onSaved: (profile: TabibitoProfile) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [emoji, setEmoji] = useState(profile?.avatarEmoji ?? AVATAR_EMOJI[0]);
  const [color, setColor] = useState(profile?.avatarColor ?? AVATAR_COLORS[0]);

  const displayName = profile?.displayName?.trim() || fallbackName || "旅人";
  const avatarEmoji = profile?.avatarEmoji ?? "🐣";
  const avatarColor = profile?.avatarColor ?? AVATAR_COLORS[0];
  const rank = levelFor(visitedCount);

  async function handleSave() {
    setBusy(true);
    const next: TabibitoProfile = {
      displayName: name.trim() || undefined,
      bio: bio.trim() || undefined,
      avatarEmoji: emoji,
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {AVATAR_EMOJI.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEmoji(option)}
              className={`grid h-9 w-9 place-items-center rounded-full border text-lg transition ${
                emoji === option
                  ? "border-vermilion"
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
    <div className="flex items-center gap-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
      <div
        className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-3xl"
        style={{ backgroundColor: `${avatarColor}22` }}
      >
        {avatarEmoji}
      </div>
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
            制覇した都道府県で旅人ランクが上がります。
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
  );
}
