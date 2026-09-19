"use client";

import { useRouter } from "next/navigation";
import { Globe, Lock, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  createGroup,
  joinPublicGroup,
  listMyGroups,
  searchPublicGroups,
} from "@/lib/api/groups";
import { listFriendProfiles } from "@/lib/api/social";
import { GROUP_COVERS } from "@/lib/groupCovers";
import { openAuthDialog } from "@/components/AuthDialog";
import { CabinetHeader } from "@/components/CabinetHeader";
import { GroupCard } from "@/components/GroupCard";
import type { Group, GroupCover, PublicProfile } from "@/types";

const GROUP_EMOJI = ["⛺", "🚌", "🗻", "🍜", "📷", "🎒", "🌊", "🏮"];
const COVER_KEYS = Object.keys(GROUP_COVERS) as GroupCover[];

export default function GroupsPage() {
  const router = useRouter();
  const { enabled, loading, user } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(GROUP_EMOJI[0]);
  const [cover, setCover] = useState<GroupCover>("forest");
  const [about, setAbout] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Discover / search.
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Group[] | null>(null);
  const [searching, setSearching] = useState(false);

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

  useEffect(() => {
    const q = term.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchPublicGroups(q)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

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
      const id = await createGroup(user.uid, name.trim(), emoji, [...picked], {
        visibility,
        about,
        cover,
      });
      if (id) {
        setGroups((current) => [
          {
            id,
            name: name.trim(),
            emoji,
            cover,
            about: about.trim(),
            visibility,
            ownerUid: user.uid,
            members: [user.uid, ...picked],
          },
          ...(current ?? []),
        ]);
        setCreating(false);
        setName("");
        setAbout("");
        setPicked(new Set());
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(group: Group) {
    if (!user) return;
    await joinPublicGroup(group.id, user.uid).catch(() => {});
    router.push(`/groups/${group.id}`);
  }

  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-xs font-bold transition ${
      active
        ? "bg-vermilion text-white"
        : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
    }`;

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader
        eyebrow="みんなで"
        title="グループ"
        subtitle="仲間と集まって、チャットしながら次の旅を企てよう。"
        mascot="pointing"
        accent="vermilion"
      />

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
        <div className="mt-8 space-y-6">
          {/* Discover */}
          <div>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
              />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="公開グループを探す（例: 温泉、登山…）"
                className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] py-2.5 pl-11 pr-4 text-sm font-medium outline-none focus:border-vermilion"
              />
            </div>
            {term.trim() && (
              <div className="mt-3 space-y-2">
                {searching && (
                  <p className="text-xs font-medium text-[color:var(--muted)]">
                    探しています…
                  </p>
                )}
                {!searching && results?.length === 0 && (
                  <p className="text-xs font-medium text-[color:var(--muted)]">
                    見つかりませんでした。
                  </p>
                )}
                {results
                  ?.filter((g) => !g.members.includes(user.uid))
                  .map((g) => (
                    <GroupCard
                      key={g.id}
                      group={g}
                      trailing={
                        <button
                          type="button"
                          onClick={() => handleJoin(g)}
                          className="rounded-full bg-vermilion px-4 py-1.5 text-xs font-black text-white transition hover:opacity-90"
                        >
                          参加
                        </button>
                      }
                    />
                  ))}
              </div>
            )}
          </div>

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
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
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

              {/* cover + emoji preview */}
              <div
                className="mt-3 flex h-20 items-center justify-center rounded-xl text-4xl"
                style={{ background: GROUP_COVERS[cover].css }}
              >
                {emoji}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COVER_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={GROUP_COVERS[key].label}
                    onClick={() => setCover(key)}
                    style={{ background: GROUP_COVERS[key].css }}
                    className={`h-8 w-12 rounded-lg transition ${
                      cover === key
                        ? "ring-2 ring-vermilion ring-offset-2 ring-offset-[color:var(--surface)]"
                        : ""
                    }`}
                  />
                ))}
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
              <textarea
                value={about}
                onChange={(event) => setAbout(event.target.value)}
                placeholder="どんなグループ？（任意）"
                maxLength={140}
                rows={2}
                className="mt-2 w-full resize-none rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-2.5 text-sm font-medium outline-none focus:border-vermilion"
              />

              {/* visibility */}
              <div className="mt-3 inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-1">
                <button
                  type="button"
                  onClick={() => setVisibility("private")}
                  className={`inline-flex items-center gap-1.5 ${chip(
                    visibility === "private",
                  )}`}
                >
                  <Lock size={12} /> 非公開
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  className={`inline-flex items-center gap-1.5 ${chip(
                    visibility === "public",
                  )}`}
                >
                  <Globe size={12} /> 公開
                </button>
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-[color:var(--muted)]">
                {visibility === "public"
                  ? "誰でも検索して参加できます。"
                  : "招待した人だけが参加できます。"}
              </p>

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

          {groups !== null && groups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-black text-[color:var(--muted)]">
                私のグループ
              </p>
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isOwner={group.ownerUid === user.uid}
                  href={`/groups/${group.id}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
