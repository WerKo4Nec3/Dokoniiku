"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  LogOut,
  MapPin,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOpenJourney, useUserJourneys } from "@/lib/hooks/cabinet";
import {
  addGroupMembers,
  createGroupEvent,
  deleteGroup,
  deleteGroupEvent,
  getGroup,
  leaveGroup,
  sendGroupMessage,
  setEventParticipation,
  subscribeGroupEvents,
  subscribeGroupMessages,
} from "@/lib/api/groups";
import { getPublicProfile, listFriendProfiles } from "@/lib/api/social";
import { fetchProfile } from "@/lib/api/profile";
import { openAuthDialog } from "@/components/AuthDialog";
import type {
  Group,
  GroupEvent,
  GroupMessage,
  PublicProfile,
  TabibitoProfile,
} from "@/types";

function timeOf(message: GroupMessage): string {
  try {
    const date = message.createdAt?.toDate();
    if (!date) return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes(),
    ).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export default function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = use(params);
  const router = useRouter();
  const { enabled, loading, user } = useAuth();
  const { journeys } = useUserJourneys();
  const openJourney = useOpenJourney();

  const [group, setGroup] = useState<Group | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [members, setMembers] = useState<Map<string, PublicProfile>>(new Map());
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [profile, setProfile] = useState<TabibitoProfile | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventJourneyId, setEventJourneyId] = useState<string>("");
  const [eventDate, setEventDate] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const myName =
    profile?.displayName?.trim() ||
    user?.displayName ||
    user?.email ||
    "旅人";

  // Load the group + my profile + my friends (for inviting).
  useEffect(() => {
    if (!user) return;
    let active = true;
    getGroup(groupId)
      .then((data) => {
        if (!active) return;
        if (!data) setNotFound(true);
        else setGroup(data);
      })
      .catch(() => setNotFound(true));
    fetchProfile(user.uid)
      .then((data) => {
        if (active && data) setProfile(data);
      })
      .catch(() => {});
    listFriendProfiles(user.uid)
      .then((items) => {
        if (active) setFriends(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, groupId]);

  // Member profiles for names/avatars.
  useEffect(() => {
    if (!group) return;
    let active = true;
    Promise.all(
      group.members.map((uid) =>
        getPublicProfile(uid)
          .then((p) => [uid, p] as const)
          .catch(() => [uid, null] as const),
      ),
    ).then((entries) => {
      if (!active) return;
      const map = new Map<string, PublicProfile>();
      for (const [uid, p] of entries) if (p) map.set(uid, p);
      setMembers(map);
    });
    return () => {
      active = false;
    };
  }, [group]);

  // Live chat + events.
  useEffect(() => {
    if (!user || !group) return;
    const stopMessages = subscribeGroupMessages(groupId, setMessages);
    const stopEvents = subscribeGroupEvents(groupId, setEvents);
    return () => {
      stopMessages();
      stopEvents();
    };
  }, [user, group, groupId]);

  // Keep the chat pinned to the newest message.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const invitable = useMemo(
    () => friends.filter((friend) => !group?.members.includes(friend.uid)),
    [friends, group],
  );

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !draft.trim()) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      await sendGroupMessage(groupId, user.uid, myName, text);
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  async function handleInvite(friend: PublicProfile) {
    await addGroupMembers(groupId, [friend.uid]).catch(() => {});
    setGroup((current) =>
      current
        ? { ...current, members: [...current.members, friend.uid] }
        : current,
    );
  }

  async function handleLeave() {
    if (!user || !group) return;
    if (group.ownerUid === user.uid) {
      await deleteGroup(groupId).catch(() => {});
    } else {
      await leaveGroup(groupId, user.uid).catch(() => {});
    }
    router.push("/groups");
  }

  async function handleCreateEvent() {
    if (!user || !eventJourneyId || !eventDate) return;
    const journey = (journeys ?? []).find((item) => item.id === eventJourneyId);
    if (!journey) return;
    await createGroupEvent(groupId, user.uid, myName, eventDate, journey).catch(
      () => {},
    );
    setEventOpen(false);
    setEventJourneyId("");
    setEventDate("");
  }

  const gated = !enabled || loading || !user;

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-20 pt-24 sm:px-6">
      <Link
        href="/groups"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <ArrowLeft size={16} />
        グループ一覧へ
      </Link>

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

      {!gated && notFound && (
        <p className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
          このグループは見つかりませんでした（削除されたか、メンバーではありません）。
        </p>
      )}

      {!gated && group && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-5"
        >
          {/* Header */}
          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest/10 text-2xl">
                {group.emoji ?? "⛺"}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-black">{group.name}</h1>
                <p className="text-[11px] font-bold text-[color:var(--muted)]">
                  {group.members.length}人のメンバー
                </p>
              </div>
              <button
                type="button"
                onClick={handleLeave}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--line)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--muted)] transition hover:border-vermilion/50 hover:text-vermilion"
              >
                {group.ownerUid === user.uid ? (
                  <>
                    <Trash2 size={12} />
                    グループを削除
                  </>
                ) : (
                  <>
                    <LogOut size={12} />
                    退出
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {group.members.map((uid) => {
                const member = members.get(uid);
                return (
                  <span
                    key={uid}
                    title={member?.displayName ?? "旅人"}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1 text-[11px] font-bold"
                  >
                    <span aria-hidden>{member?.avatarEmoji ?? "🐣"}</span>
                    {member?.displayName ?? "旅人"}
                    {uid === group.ownerUid && (
                      <span className="text-[9px] text-[color:var(--muted)]">
                        管理
                      </span>
                    )}
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => setInviteOpen((open) => !open)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--line)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
              >
                <UserPlus size={11} />
                誘う
              </button>
            </div>

            {inviteOpen && (
              <div className="mt-3 rounded-lg bg-[color:var(--surface-muted)] p-3">
                {invitable.length === 0 ? (
                  <p className="text-xs font-medium text-[color:var(--muted)]">
                    誘える友達がいません（全員参加済みか、まだ友達がいません）。
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {invitable.map((friend) => (
                      <button
                        key={friend.uid}
                        type="button"
                        onClick={() => handleInvite(friend)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-bold transition hover:border-vermilion/50"
                      >
                        <span aria-hidden>{friend.avatarEmoji ?? "🐣"}</span>
                        {friend.displayName ?? "名もなき旅人"}
                        <UserPlus size={11} className="text-[color:var(--muted)]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Events */}
          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">みんなの予定</h2>
              <button
                type="button"
                onClick={() => setEventOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-full bg-vermilion px-3.5 py-1.5 text-[11px] font-black text-white transition hover:opacity-90"
              >
                <CalendarPlus size={12} />
                イベントを作る
              </button>
            </div>

            {eventOpen && (
              <div className="mt-3 rounded-lg bg-[color:var(--surface-muted)] p-3">
                <p className="text-xs font-bold text-[color:var(--muted)]">
                  保存した旅から選ぶ
                </p>
                <select
                  value={eventJourneyId}
                  onChange={(event) => setEventJourneyId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-3 py-2 text-sm font-medium outline-none focus:border-vermilion"
                >
                  <option value="">場所を選ぶ…</option>
                  {(journeys ?? []).map((journey) => (
                    <option key={journey.id} value={journey.id}>
                      {journey.destination.name}（{journey.prefecture.nameJa}）
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(event) => setEventDate(event.target.value)}
                    className="rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-3 py-2 text-sm font-medium outline-none focus:border-vermilion"
                  />
                  <button
                    type="button"
                    onClick={handleCreateEvent}
                    disabled={!eventJourneyId || !eventDate}
                    className="rounded-full bg-vermilion px-4 py-2 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    作成
                  </button>
                </div>
                {(journeys ?? []).length === 0 && (
                  <p className="mt-2 text-xs font-medium text-[color:var(--muted)]">
                    まだ保存した旅がありません。ホームで見つけて保存してね。
                  </p>
                )}
              </div>
            )}

            {events.length === 0 ? (
              <p className="mt-3 text-xs font-medium text-[color:var(--muted)]">
                まだ予定がありません。カードと日付でイベントを作ろう。
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {events.map((item) => {
                  const joined = item.participants.includes(user.uid);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-[color:var(--line)] p-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => openJourney(item.journey)}
                        aria-label={item.journey.destination.name}
                        className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-forest/10 bg-cover bg-center"
                        style={
                          item.journey.destination.imageUrl
                            ? {
                                backgroundImage: `url('${item.journey.destination.imageUrl}')`,
                              }
                            : undefined
                        }
                      >
                        {!item.journey.destination.imageUrl && (
                          <span className="grid h-full w-full place-items-center text-forest/50">
                            <MapPin size={18} />
                          </span>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">
                          {item.journey.destination.name}
                        </p>
                        <p className="text-[11px] font-bold text-vermilion">
                          {item.date.replace(/-/g, "/")}
                        </p>
                        <p className="text-[10px] font-medium text-[color:var(--muted)]">
                          {item.participants.length}人参加 ・{" "}
                          {item.createdByName ?? "旅人"}が企画
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEventParticipation(
                              groupId,
                              item.id,
                              user.uid,
                              !joined,
                            ).catch(() => {})
                          }
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                            joined
                              ? "bg-forest/10 text-forest dark:text-[#8fd0b9]"
                              : "bg-vermilion text-white hover:opacity-90"
                          }`}
                        >
                          {joined ? <Check size={11} /> : null}
                          {joined ? "参加中" : "参加する"}
                        </button>
                        {item.createdBy === user.uid && (
                          <button
                            type="button"
                            onClick={() =>
                              deleteGroupEvent(groupId, item.id).catch(() => {})
                            }
                            aria-label="イベントを削除"
                            className="grid h-6 w-6 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-vermilion/10 hover:text-vermilion"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Chat */}
          <div className="flex h-[26rem] flex-col rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)]">
            <h2 className="border-b border-[color:var(--line)] px-5 py-3 text-sm font-black">
              チャット
            </h2>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <p className="text-xs font-medium text-[color:var(--muted)]">
                  まだメッセージがありません。最初のひとことをどうぞ。
                </p>
              )}
              {messages.map((message) => {
                const mine = message.uid === user.uid;
                const member = members.get(message.uid);
                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[80%] ${mine ? "text-right" : ""}`}>
                      {!mine && (
                        <p className="mb-0.5 text-[10px] font-bold text-[color:var(--muted)]">
                          {member?.avatarEmoji ?? "🐣"}{" "}
                          {message.name ?? member?.displayName ?? "旅人"}
                        </p>
                      )}
                      <div
                        className={`inline-block rounded-2xl px-3.5 py-2 text-sm font-medium leading-6 ${
                          mine
                            ? "rounded-br-sm bg-vermilion text-white"
                            : "rounded-bl-sm bg-[color:var(--surface-muted)]"
                        }`}
                      >
                        {message.text}
                      </div>
                      <p className="mt-0.5 text-[9px] font-medium text-[color:var(--muted)]">
                        {timeOf(message)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-[color:var(--line)] p-3"
            >
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="メッセージを書く…"
                maxLength={500}
                className="min-w-0 flex-1 rounded-full border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-2.5 text-sm font-medium outline-none focus:border-vermilion"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="送信"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-vermilion text-white transition hover:opacity-90 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </section>
  );
}
