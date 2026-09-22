"use client";

import { Users } from "lucide-react";
import type { PublicProfile } from "@/types";

type Entry = {
  uid: string;
  name: string;
  visitedCount: number;
  avatarEmoji?: string;
  isMe?: boolean;
};

const MEDALS = ["🥇", "🥈", "🥉"];

// A friendly ranking of you + your friends by places completed (制覇). Uses the
// public `visitedCount` that already syncs to each traveller's profile.
export function FriendLeaderboard({
  me,
  friends,
}: {
  me: { uid: string; name: string; visitedCount: number; avatarEmoji?: string };
  friends: PublicProfile[];
}) {
  const entries: Entry[] = [
    { ...me, isMe: true },
    ...friends.map((f) => ({
      uid: f.uid,
      name: f.displayName ?? "名もなき旅人",
      visitedCount: f.visitedCount ?? 0,
      avatarEmoji: f.avatarEmoji,
    })),
  ].sort((a, b) => b.visitedCount - a.visitedCount || a.name.localeCompare(b.name));

  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-5 sm:p-6">
      <h3 className="inline-flex items-center gap-2 text-sm font-black">
        <Users size={16} className="text-forest dark:text-forest-ink" />
        仲間ランキング
      </h3>

      {friends.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-[color:var(--muted)]">
          仲間を追加すると、制覇数でランキングを競えます。
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {entries.map((entry, index) => (
            <li
              key={entry.uid}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                entry.isMe
                  ? "border-vermilion/40 bg-vermilion/5"
                  : "border-[color:var(--line)]"
              }`}
            >
              <span className="grid w-7 shrink-0 place-items-center text-sm font-black tabular-nums text-[color:var(--muted)]">
                {MEDALS[index] ?? index + 1}
              </span>
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--surface-muted)] text-base"
              >
                {entry.avatarEmoji ?? "🐣"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold">
                {entry.name}
                {entry.isMe && (
                  <span className="ml-1.5 text-[10px] font-black text-vermilion">
                    あなた
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm font-black tabular-nums">
                {entry.visitedCount}
                <span className="ml-0.5 text-[11px] font-bold text-[color:var(--muted)]">
                  件
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
