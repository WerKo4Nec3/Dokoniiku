"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Plus, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createGroup, listMyGroups } from "@/lib/api/groups";
import { listFriendProfiles } from "@/lib/api/social";
import { openAuthDialog } from "@/components/AuthDialog";
import { CabinetNav } from "@/components/CabinetNav";
import type { Group, PublicProfile } from "@/types";

const GROUP_EMOJI = ["⛺", "🚌", "🗻", "🍜", "📷", "🎒", "🌊", "🏮"];

export default function GroupsPage() {
  const { enabled, loading, user } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(GROUP_EMOJI[0]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    listMyGroups(user.uid)
      .then((items) => {
        if (active) setGroups(items);
      })
      .catch(() => {
        if (active) setGroups([]);
      });
    listFriendProfiles(user.uid)
      .then((items) => {
        if (active) setFriends(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  function togglePick(uid: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function handleCreate() {
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const id = await createGroup(user.uid, name.trim(), emoji, [...picked]);
      if (id) {
        setGroups((current) => [
          {
            id,
            name: name.trim(),
            emoji,
            ownerUid: user.uid,
            members: [user.uid, ...picked],
          },
          ...(current ?? []),
        ]);
        setCreating(false);
        setName("");
        setPicked(new Set());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-20 pt-24 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <ArrowLeft size={16} />
        旅にもどる
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">グループ</h1>
        <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
          仲間と集まって、チャットしながら次の旅を企てよう。
        </p>
        <CabinetNav />
      </motion.div>

      {!enabled && (
        <p className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
          アカウント機能は現在設定されていません。
        </p>
      )}

      {enabled && !loading && !user && (
        <div className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm font-medium text-[color:var(--muted)]">
            ログインすると、グループが使えます。
          </p>
          <button
            type="button"
            onClick={() => openAuthDialog()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            ログイン / 新規登録
          </button>
        </div>
      )}

      {enabled && user && (
        <div className="mt-8 space-y-4">
          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-full bg-vermilion px-5 py-2.5 text-sm font-black text-white shadow-sm shadow-vermilion/30 transition hover:opacity-90"
            >
              <Plus size={16} />
              グループを作る
            </button>
          ) : (
            <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black">新しいグループ</h2>
                <button
                  type="button"
                  aria-label="閉じる"
                  onClick={() => setCreating(false)}
                  className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {GROUP_EMOJI.map((option) => (
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

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="グループ名（例: 週末温泉部）"
                maxLength={30}
                className="mt-3 w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-2.5 text-sm font-medium outline-none focus:border-vermilion"
              />

              <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                友達を誘う（あとからも追加できます）
              </p>
              {friends.length === 0 ? (
                <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                  まだ友達がいません。仲間ページでQRを交換してね。
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {friends.map((friend) => (
                    <button
                      key={friend.uid}
                      type="button"
                      onClick={() => togglePick(friend.uid)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        picked.has(friend.uid)
                          ? "border-vermilion bg-vermilion/10 text-vermilion"
                          : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                      }`}
                    >
                      <span aria-hidden>{friend.avatarEmoji ?? "🐣"}</span>
                      {friend.displayName ?? "名もなき旅人"}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={busy || !name.trim()}
                  className="rounded-full bg-vermilion px-5 py-2 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  作成する
                </button>
              </div>
            </div>
          )}

          {groups === null && (
            <p className="text-sm font-medium text-[color:var(--muted)]">
              読み込み中…
            </p>
          )}

          {groups !== null && groups.length === 0 && !creating && (
            <p className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
              まだグループがありません。最初のグループを作ってみよう。
            </p>
          )}

          {groups !== null &&
            groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="flex items-center gap-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-4 shadow-float transition hover:border-vermilion/50"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest/10 text-2xl">
                  {group.emoji ?? "⛺"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">
                    {group.name}
                  </span>
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--muted)]">
                    <UsersRound size={12} />
                    {group.members.length}人
                    {group.ownerUid === user.uid && " ・ あなたが管理"}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-[color:var(--muted)]"
                />
              </Link>
            ))}
        </div>
      )}
    </section>
  );
}
