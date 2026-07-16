"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Send } from "lucide-react";
import type { JourneyResult, PublicProfile } from "@/types";
import { listFriendProfiles, shareCardWithFriend } from "@/lib/api/social";

// Small per-card control: pick a friend, send them this journey card.
export function ShareToFriendButton({
  uid,
  myName,
  journey,
}: {
  uid: string;
  myName: string;
  journey: JourneyResult;
}) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<PublicProfile[] | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Friends are fetched the first time the picker opens.
  useEffect(() => {
    if (!open || friends !== null) return;
    listFriendProfiles(uid)
      .then(setFriends)
      .catch(() => setFriends([]));
  }, [open, friends, uid]);

  async function handleSend(friend: PublicProfile) {
    try {
      await shareCardWithFriend(uid, friend.uid, journey, myName);
      setSentTo((current) => new Set(current).add(friend.uid));
    } catch {
      // rules not deployed / offline — nothing else to do here.
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-label="友達に共有"
        title="友達に共有"
        aria-expanded={open}
        className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-forest/10 hover:text-forest dark:hover:text-[#8fd0b9]"
      >
        <Send size={14} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] py-1 shadow-float"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[10px] font-bold text-[color:var(--muted)]">
            友達に共有
          </p>
          {friends === null && (
            <p className="px-3 py-2 text-xs font-medium text-[color:var(--muted)]">
              読み込み中…
            </p>
          )}
          {friends !== null && friends.length === 0 && (
            <p className="px-3 py-2 text-xs font-medium text-[color:var(--muted)]">
              まだ友達がいません。仲間パネルでコードを交換してね。
            </p>
          )}
          {friends?.map((friend) => {
            const sent = sentTo.has(friend.uid);
            return (
              <button
                key={friend.uid}
                type="button"
                disabled={sent}
                onClick={() => handleSend(friend)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold transition hover:bg-[color:var(--surface-muted)] disabled:opacity-60"
              >
                <span aria-hidden>{friend.avatarEmoji ?? "🐣"}</span>
                <span className="min-w-0 flex-1 truncate text-left">
                  {friend.displayName ?? "名もなき旅人"}
                </span>
                {sent && <Check size={13} className="shrink-0 text-forest" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
