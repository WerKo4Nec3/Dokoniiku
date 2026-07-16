"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  Copy,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type {
  FriendRequest,
  PublicProfile,
  SharedCard,
  TabibitoProfile,
} from "@/types";
import {
  acceptFriendRequest,
  declineFriendRequest,
  deleteSharedCard,
  ensurePublicProfile,
  findByFriendCode,
  listFriendProfiles,
  listIncomingRequests,
  listSharedInbox,
  removeFriend,
  sendFriendRequest,
} from "@/lib/api/social";
import type { JourneyResult } from "@/types";

export function FriendsPanel({
  uid,
  profile,
  fallbackName,
  visitedCount,
  onOpenJourney,
  onSaveShared,
}: {
  uid: string;
  profile: TabibitoProfile | null;
  fallbackName: string;
  visitedCount: number;
  onOpenJourney: (journey: JourneyResult) => void;
  onSaveShared: (journey: JourneyResult) => Promise<void>;
}) {
  const [me, setMe] = useState<PublicProfile | null>(null);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [inbox, setInbox] = useState<SharedCard[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const myName = profile?.displayName?.trim() || fallbackName;

  const refresh = useCallback(async () => {
    const [nextFriends, nextRequests, nextInbox] = await Promise.all([
      listFriendProfiles(uid).catch(() => []),
      listIncomingRequests(uid).catch(() => []),
      listSharedInbox(uid).catch(() => []),
    ]);
    setFriends(nextFriends);
    setRequests(nextRequests);
    setInbox(nextInbox);
  }, [uid]);

  useEffect(() => {
    let active = true;
    ensurePublicProfile(uid, {
      ...profile,
      displayName: myName,
      visitedCount,
    })
      .then((publicProfile) => {
        if (active && publicProfile) setMe(publicProfile);
      })
      .catch(() => {});
    refresh();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, profile, visitedCount]);

  async function handleAdd() {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (me && code === me.friendCode) {
        setFeedback("それはあなた自身のコードです。");
        return;
      }
      const target = await findByFriendCode(code);
      if (!target) {
        setFeedback("このコードの旅人は見つかりませんでした。");
        return;
      }
      if (friends.some((friend) => friend.uid === target.uid)) {
        setFeedback(`${target.displayName ?? "その旅人"}とはもう友達です。`);
        return;
      }
      await sendFriendRequest(uid, target.uid, myName);
      setFeedback(
        `${target.displayName ?? "旅人"}にリクエストを送りました。承認を待ってね。`,
      );
      setCodeInput("");
    } catch {
      setFeedback("送信できませんでした。少し待ってからもう一度。");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(request: FriendRequest) {
    setBusy(true);
    try {
      await acceptFriendRequest(uid, request.fromUid);
      await refresh();
    } catch {
      setFeedback("承認できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline(request: FriendRequest) {
    setBusy(true);
    try {
      await declineFriendRequest(uid, request.fromUid);
      setRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUnfriend(friend: PublicProfile) {
    setBusy(true);
    try {
      await removeFriend(uid, friend.uid);
      setFriends((current) =>
        current.filter((item) => item.uid !== friend.uid),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveShared(card: SharedCard) {
    await onSaveShared(card.journey);
    setSavedIds((current) => new Set(current).add(card.id));
  }

  async function handleDismissShared(card: SharedCard) {
    await deleteSharedCard(card.id).catch(() => {});
    setInbox((current) => current.filter((item) => item.id !== card.id));
  }

  async function copyCode() {
    if (!me) return;
    try {
      await navigator.clipboard.writeText(me.friendCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — the code is visible to copy by hand.
    }
  }

  return (
    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-black">
          <Users size={16} />
          旅の仲間
        </h2>
        <button
          type="button"
          onClick={() => refresh()}
          aria-label="更新"
          className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* My friend code */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-[color:var(--surface-muted)] px-4 py-3">
        <span className="text-xs font-bold text-[color:var(--muted)]">
          あなたの友達コード
        </span>
        <span className="font-mono text-base font-black tracking-[0.2em]">
          {me?.friendCode ?? "……"}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "コピーした！" : "コピー"}
        </button>
      </div>

      {/* Add a friend */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={codeInput}
          onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
          placeholder="友達コードを入力（例: A2C4EF）"
          maxLength={6}
          className="min-w-0 flex-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-3 py-2 font-mono text-sm font-bold uppercase tracking-widest outline-none focus:border-vermilion"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || codeInput.trim().length < 6}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-forest px-3.5 py-2 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <UserPlus size={14} />
          申請
        </button>
      </div>
      {feedback && (
        <p className="mt-2 text-xs font-bold text-[color:var(--muted)]">
          {feedback}
        </p>
      )}

      {/* Incoming requests */}
      {requests.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-vermilion">
            届いたリクエスト（{requests.length}）
          </p>
          <ul className="mt-2 space-y-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-vermilion/30 bg-vermilion/5 px-3 py-2"
              >
                <span className="truncate text-sm font-bold">
                  {request.fromName ?? "名もなき旅人"}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAccept(request)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-[11px] font-black text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Check size={12} />
                    承認
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(request)}
                    disabled={busy}
                    aria-label="辞退"
                    className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
                  >
                    <X size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Friends list */}
      <div className="mt-5">
        <p className="text-xs font-bold text-[color:var(--muted)]">
          友達（{friends.length}）
        </p>
        {friends.length === 0 ? (
          <p className="mt-2 text-xs font-medium text-[color:var(--muted)]">
            コードを交換して、旅の仲間を増やそう。
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {friends.map((friend) => (
              <li
                key={friend.uid}
                className="flex items-center gap-3 rounded-lg border border-[color:var(--line)] px-3 py-2"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                  style={{
                    backgroundColor: `${friend.avatarColor ?? "#285f4d"}22`,
                  }}
                >
                  {friend.avatarEmoji ?? "🐣"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {friend.displayName ?? "名もなき旅人"}
                  </span>
                  <span className="block text-[11px] font-medium text-[color:var(--muted)]">
                    制覇 {friend.visitedCount ?? 0}件
                    {friend.bio ? ` ・ ${friend.bio}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleUnfriend(friend)}
                  disabled={busy}
                  aria-label="友達から外す"
                  title="友達から外す"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-vermilion/10 hover:text-vermilion"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Shared-with-me inbox */}
      {inbox.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-[color:var(--muted)]">
            共有された旅（{inbox.length}）
          </p>
          <ul className="mt-2 space-y-2">
            {inbox.map((card) => (
              <li
                key={card.id}
                className="flex items-center gap-3 rounded-lg border border-[color:var(--line)] px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => onOpenJourney(card.journey)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-bold underline-offset-2 hover:underline">
                    {card.journey.destination.name}
                  </span>
                  <span className="block text-[11px] font-medium text-[color:var(--muted)]">
                    {card.journey.prefecture.nameJa} ・{" "}
                    {card.fromName ?? "旅人"}から
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveShared(card)}
                  disabled={savedIds.has(card.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--line)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] disabled:opacity-50"
                >
                  <Bookmark size={12} />
                  {savedIds.has(card.id) ? "保存済み" : "保存"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissShared(card)}
                  aria-label="削除"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-vermilion/10 hover:text-vermilion"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
