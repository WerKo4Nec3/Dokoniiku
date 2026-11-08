"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Crown,
  Globe,
  Link2,
  Lock,
  MapPin,
  Pencil,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useUserJourneys } from "@/lib/hooks/cabinet";
import { checkAdmin } from "@/lib/api/admin";
import { fetchProfile } from "@/lib/api/profile";
import { listFriendProfiles } from "@/lib/api/social";
import {
  acceptInvite,
  approveRequest,
  declineInvite,
  deleteMeetup,
  inviteToMeetup,
  joinOpenMeetup,
  leaveMeetup,
  rejectRequest,
  removeMember,
  requestToJoin,
  sendMeetupMessage,
  subscribeMeetup,
  subscribeMeetupMessages,
  todayJst,
  updateMeetup,
  withdrawRequest,
} from "@/lib/api/meetups";
import { coverCss } from "@/lib/groupCovers";
import { GROUP_CATEGORIES } from "@/lib/groupCategories";
import { isFull, isPast, mapsUrl, meetupWhen, personFrom, roleOf } from "@/lib/meetupFormat";
import { displayPlaceName } from "@/lib/utils/travel";
import { markChatRead, markInboxSeen, setActiveChat, useInbox } from "@/lib/inbox";
import { openAuthDialog } from "@/components/AuthDialog";
import { PersonAvatar } from "@/components/meetups/MeetupCard";
import { MeetupForm, type SavedPlace } from "@/components/meetups/MeetupForm";
import type { GroupMessage, Meetup, PublicProfile, TabibitoProfile } from "@/types";

function timeOf(message: GroupMessage): string {
  try {
    const date = message.createdAt?.toDate();
    if (!date) return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

const card = "card-3d rounded-[24px] bg-[color:var(--surface)] p-4 sm:p-5";

export default function MeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { enabled, loading, user, journeys } = useUserJourneys();
  const [meetup, setMeetup] = useState<Meetup | null | undefined>(undefined);
  const [today, setToday] = useState("");
  const [profile, setProfile] = useState<TabibitoProfile | null>(null);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(todayJst()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // A private event you weren't invited to can't be read at all.
  useEffect(() => {
    if (!user) return;
    return subscribeMeetup(id, setMeetup, () => setMeetup(null));
  }, [id, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchProfile(user.uid).then((data) => active && setProfile(data)).catch(() => {});
    listFriendProfiles(user.uid).then((items) => active && setFriends(items)).catch(() => {});
    checkAdmin(user.uid).then((value) => active && setIsAdmin(value)).catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const role = meetup ? roleOf(meetup, user?.uid) : "guest";
  const going = role === "host" || role === "member";

  useEffect(() => {
    if (!going) return;
    return subscribeMeetupMessages(id, setMessages);
  }, [id, going]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // While you're on this event its news is read: the chat (up to its
  // latest message), the invite, join requests.
  const inbox = useInbox();
  useEffect(() => {
    if (!going) return;
    setActiveChat(id);
    return () => setActiveChat(null);
  }, [id, going]);
  useEffect(() => {
    const latest = messages.at(-1)?.createdAt?.toDate().getTime();
    if (going && latest) markChatRead(id, latest);
  }, [id, going, messages]);
  useEffect(() => {
    markInboxSeen((item) => item.meetupId === id);
  }, [id, inbox.items]);

  const places = useMemo<SavedPlace[]>(() => {
    const seen = new Set<string>();
    return (journeys ?? []).flatMap((journey) => {
      if (seen.has(journey.destination.id)) return [];
      seen.add(journey.destination.id);
      return [
        {
          id: journey.destination.id,
          name: displayPlaceName(journey.destination.name),
          prefecture: journey.prefecture.nameJa,
          latitude: journey.destination.latitude,
          longitude: journey.destination.longitude,
        },
      ];
    });
  }, [journeys]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  if (enabled && !loading && !user) {
    return (
      <Shell>
        <div className={`${card} text-center`}>
          <p className="text-sm font-medium text-[color:var(--muted)]">ログインすると、イベントの詳細を見られます。</p>
          <button
            type="button"
            onClick={() => openAuthDialog()}
            className="mt-4 rounded-full bg-vermilion px-5 py-2.5 text-sm font-bold text-white"
          >
            ログイン / 新規登録
          </button>
        </div>
      </Shell>
    );
  }

  if (meetup === undefined || !user) {
    return (
      <Shell>
        <p className="py-10 text-center text-xs font-bold text-[color:var(--muted)]">読み込み中…</p>
      </Shell>
    );
  }

  if (meetup === null) {
    return (
      <Shell>
        <div className={`${card} text-center`}>
          <p className="text-3xl">🔒</p>
          <p className="mt-2 text-sm font-bold">このイベントは見つからないか、招待された人だけが見られます。</p>
        </div>
      </Shell>
    );
  }

  const me = personFrom(profile, user.displayName);
  const host = meetup.people[meetup.hostUid];
  const full = isFull(meetup);
  const past = Boolean(today) && isPast(meetup, today);
  const map = mapsUrl(meetup);
  const category = GROUP_CATEGORIES[meetup.category];
  const invitable = friends.filter(
    (friend) =>
      !meetup.members.includes(friend.uid) && !meetup.invites.includes(friend.uid) && !meetup.pending.includes(friend.uid),
  );

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !user) return;
    setDraft("");
    await sendMeetupMessage(id, user.uid, me.name, text).catch(() => setDraft(text));
  }

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Shell>
      {/* Cover */}
      <div className="relative overflow-clip rounded-[28px] border border-[color:var(--line)]">
        <div className="grid h-40 place-items-center text-7xl sm:h-48" style={{ background: coverCss(meetup.cover) }}>
          <span className="drop-shadow">{meetup.emoji ?? category?.emoji ?? "🎒"}</span>
        </div>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {meetup.official && (
            <span className="rounded-full bg-vermilion px-2.5 py-1 text-[10px] font-black text-white">公式イベント</span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">
            {meetup.visibility === "public" ? <Globe size={11} /> : <Lock size={11} />}
            {meetup.visibility === "public" ? "公開" : "招待のみ"}
          </span>
          {meetup.visibility === "public" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">
              {meetup.joinPolicy === "open" ? <Zap size={11} /> : <UserCheck size={11} />}
              {meetup.joinPolicy === "open" ? "自由参加" : "承認制"}
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <div className={`mt-4 ${card}`}>
          <MeetupForm
            initial={meetup}
            today={today}
            places={places}
            canOfficial={isAdmin}
            submitLabel="変更を保存"
            onCancel={() => setEditing(false)}
            onSubmit={async (next) => {
              if (next.capacity > 0 && next.capacity < meetup.members.length) {
                throw new Error("capacity below members");
              }
              await updateMeetup(id, next);
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-[11px] font-black text-[color:var(--muted)]">
              {category?.emoji} {category?.label}
            </p>
            <h1 className="mt-1 break-words font-display text-2xl font-bold leading-tight sm:text-3xl">{meetup.title}</h1>
          </div>

          <div className={`mt-4 space-y-3 ${card}`}>
            <InfoRow icon={CalendarDays}>
              {meetupWhen(meetup.date, meetup.time)}
              {past && <span className="ml-2 text-xs font-bold text-[color:var(--muted)]">（終了）</span>}
            </InfoRow>
            {meetup.placeName && (
              <InfoRow icon={MapPin}>
                {map ? (
                  <a href={map} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-4">
                    {meetup.placeName}
                  </a>
                ) : (
                  meetup.placeName
                )}
              </InfoRow>
            )}
            <InfoRow icon={Users}>
              {meetup.members.length}
              {meetup.capacity > 0 ? ` / ${meetup.capacity}` : ""}人が参加
              {full && <span className="ml-2 text-xs font-bold text-vermilion">満員</span>}
            </InfoRow>
            <div className="flex items-center gap-2 border-t border-[color:var(--line)] pt-3">
              <PersonAvatar person={host} size={30} />
              <span className="text-sm font-bold">{host?.name ?? "旅人"}</span>
              <span className="text-[11px] font-bold text-[color:var(--muted)]">が主催</span>
            </div>
            {meetup.about && (
              <p className="whitespace-pre-wrap border-t border-[color:var(--line)] pt-3 text-sm font-medium leading-6">
                {meetup.about}
              </p>
            )}
          </div>

          {/* What you can do here */}
          <div className="mt-4 space-y-2">
            {role === "host" && (
              // Symbols only (the words wrapped on phones); names in the labels.
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="編集"
                  title="編集"
                  className="btn-3d btn-3d-plain w-full"
                >
                  <Pencil size={22} className="text-vermilion" />
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label={copied ? "リンクをコピーしました" : "リンクをコピー"}
                  title="リンクをコピー"
                  className="btn-3d btn-3d-plain w-full"
                >
                  {copied ? (
                    <Check size={22} strokeWidth={3} className="text-forest-ink" />
                  ) : (
                    <Link2 size={22} className="text-sky" />
                  )}
                  <span role="status" className="sr-only">
                    {copied ? "コピーしました" : ""}
                  </span>
                </button>
              </div>
            )}
            {role === "member" && (
              <div className="flex items-center gap-2 rounded-full bg-forest/10 px-4 py-3 text-sm font-black text-forest dark:text-forest-ink">
                <Check size={17} /> 参加予定です
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => leaveMeetup(id, user.uid))}
                  className="ml-auto text-xs font-bold text-[color:var(--muted)] underline underline-offset-4"
                >
                  参加をやめる
                </button>
              </div>
            )}
            {role === "invited" && !past && (
              <div className="rounded-[22px] border-2 border-sun/60 bg-sun/10 p-3">
                <p className="text-sm font-black">📨 {host?.name ?? "主催者"}さんから招待されています</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy || full}
                    onClick={() => run(() => acceptInvite(id, user.uid, me))}
                    className="flex-1 rounded-full bg-forest px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
                  >
                    {full ? "満員です" : "参加する"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(async () => {
                      await declineInvite(id, user.uid);
                      router.push("/meetups");
                    })}
                    className="rounded-full border border-[color:var(--line)] px-4 py-2.5 text-sm font-bold text-[color:var(--muted)]"
                  >
                    見送る
                  </button>
                </div>
              </div>
            )}
            {role === "pending" && (
              <div className="flex items-center gap-2 rounded-full bg-sun/15 px-4 py-3 text-sm font-black text-[#8c6702] dark:text-sun">
                ⏳ 主催者の承認待ちです
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => withdrawRequest(id, user.uid))}
                  className="ml-auto text-xs font-bold text-[color:var(--muted)] underline underline-offset-4"
                >
                  取り消す
                </button>
              </div>
            )}
            {role === "guest" && !past && meetup.visibility === "public" && (
              <button
                type="button"
                disabled={busy || full}
                onClick={() =>
                  run(() =>
                    meetup.joinPolicy === "open" ? joinOpenMeetup(id, user.uid, me) : requestToJoin(id, user.uid, me),
                  )
                }
                className="w-full rounded-full bg-vermilion px-5 py-3.5 text-sm font-black text-white shadow-float transition hover:opacity-90 disabled:opacity-60"
              >
                {full ? "満員です" : meetup.joinPolicy === "open" ? "参加する" : "参加を申し込む"}
              </button>
            )}
            {role === "guest" && meetup.joinPolicy === "approval" && !full && !past && (
              <p className="text-center text-[11px] font-medium text-[color:var(--muted)]">
                主催者が承認すると参加が決まり、チャットに入れます。
              </p>
            )}
          </div>

          {/* Requests (host) */}
          {role === "host" && meetup.pending.length > 0 && (
            <div className={`mt-4 ${card}`}>
              <h2 className="text-sm font-black">参加の申し込み（{meetup.pending.length}）</h2>
              <div className="mt-3 space-y-2">
                {meetup.pending.map((uid) => (
                  <div key={uid} className="flex items-center gap-2">
                    <PersonAvatar person={meetup.people[uid]} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{meetup.people[uid]?.name ?? "旅人"}</span>
                    <button
                      type="button"
                      disabled={busy || full}
                      onClick={() => run(() => approveRequest(id, uid))}
                      className="rounded-full bg-forest px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                    >
                      承認
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => rejectRequest(id, uid))}
                      className="rounded-full border border-[color:var(--line)] px-3 py-1.5 text-xs font-bold text-[color:var(--muted)]"
                    >
                      見送る
                    </button>
                  </div>
                ))}
              </div>
              {full && <p className="mt-2 text-[11px] font-bold text-vermilion">満員です。定員を増やすと承認できます。</p>}
            </div>
          )}

          {/* Who is going */}
          <div className={`mt-4 ${card}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">参加メンバー</h2>
              {going && !past && (
                <button
                  type="button"
                  onClick={() => setInviting((open) => !open)}
                  className="inline-flex items-center gap-1 rounded-full bg-sky/15 px-3 py-1.5 text-xs font-black text-[#1b7182] dark:text-sky"
                >
                  <UserPlus size={14} /> なかまを招待
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {meetup.members.map((uid) => (
                <div key={uid} className="flex items-center gap-2 rounded-xl bg-[color:var(--surface-muted)] px-2.5 py-2">
                  <Link
                    href={uid === user.uid ? "/profile" : `/u/${uid}`}
                    className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
                  >
                    <PersonAvatar person={meetup.people[uid]} size={28} />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{meetup.people[uid]?.name ?? "旅人"}</span>
                  </Link>
                  {uid === meetup.hostUid ? (
                    <Crown size={13} className="shrink-0 text-sun" />
                  ) : (
                    role === "host" && (
                      <button
                        type="button"
                        aria-label="メンバーから外す"
                        disabled={busy}
                        onClick={() => run(() => removeMember(id, uid))}
                        className="shrink-0 text-[color:var(--muted)] hover:text-vermilion"
                      >
                        <X size={13} />
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
            {meetup.invites.length > 0 && going && (
              <p className="mt-3 text-[11px] font-bold text-[color:var(--muted)]">
                招待中: {meetup.invites.map((uid) => meetup.people[uid]?.name ?? "旅人").join("、")}
              </p>
            )}

            {inviting && (
              <div className="mt-3 border-t border-[color:var(--line)] pt-3">
                {invitable.length === 0 ? (
                  <p className="text-xs font-medium text-[color:var(--muted)]">
                    招待できるなかまがいません。<Link href="/friends" className="font-bold text-sky">なかまを追加</Link>
                  </p>
                ) : (
                  <>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {invitable.map((friend) => {
                        const active = picked.has(friend.uid);
                        return (
                          <button
                            key={friend.uid}
                            type="button"
                            onClick={() =>
                              setPicked((current) => {
                                const next = new Set(current);
                                if (next.has(friend.uid)) next.delete(friend.uid);
                                else next.add(friend.uid);
                                return next;
                              })
                            }
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-bold ${
                              active ? "border-vermilion bg-vermilion/10" : "border-[color:var(--line)]"
                            }`}
                          >
                            <span className="text-lg">{friend.avatarEmoji ?? "🐣"}</span>
                            <span className="min-w-0 flex-1 truncate">{friend.displayName ?? "旅人"}</span>
                            {active && <Check size={15} className="text-vermilion" />}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={busy || picked.size === 0}
                      onClick={() =>
                        run(async () => {
                          await inviteToMeetup(
                            id,
                            invitable
                              .filter((friend) => picked.has(friend.uid))
                              .map((friend) => ({ uid: friend.uid, person: personFrom(friend, "旅人") })),
                          );
                          setPicked(new Set());
                          setInviting(false);
                        })
                      }
                      className="mt-2 w-full rounded-full bg-vermilion px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                    >
                      {picked.size ? `${picked.size}人を招待する` : "招待するなかまを選んでね"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Chat for those going */}
          <div className={`mt-4 ${card} p-0 sm:p-0`}>
            <h2 className="px-4 pt-4 text-sm font-black sm:px-5">チャット</h2>
            {going ? (
              <div className="flex h-[26rem] flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
                  {messages.length === 0 && (
                    <p className="text-xs font-medium text-[color:var(--muted)]">
                      まだメッセージがありません。集合場所や持ち物を相談しよう。
                    </p>
                  )}
                  {messages.map((message) => {
                    const mine = message.uid === user.uid;
                    const person = meetup.people[message.uid];
                    return (
                      <div key={message.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                        {!mine && <PersonAvatar person={person} size={28} />}
                        <div className={`max-w-[78%] ${mine ? "text-right" : ""}`}>
                          {!mine && (
                            <p className="mb-0.5 text-[10px] font-bold text-[color:var(--muted)]">
                              {message.name ?? person?.name ?? "旅人"}
                            </p>
                          )}
                          <div
                            className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-left text-sm font-medium leading-6 ${
                              mine ? "rounded-br-sm bg-vermilion text-white" : "rounded-bl-sm bg-[color:var(--surface-muted)]"
                            }`}
                          >
                            {message.text}
                          </div>
                          <p className="mt-0.5 text-[9px] font-medium text-[color:var(--muted)]">{timeOf(message)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={send} className="flex items-center gap-2 border-t border-[color:var(--line)] p-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="メッセージを書く…"
                    maxLength={1000}
                    className="min-w-0 flex-1 rounded-full border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-2.5 text-sm font-medium outline-none focus:border-vermilion"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    aria-label="送信"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-vermilion text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            ) : (
              <p className="flex items-center gap-2 px-4 pb-4 pt-2 text-xs font-bold text-[color:var(--muted)] sm:px-5">
                <Lock size={14} /> 参加が決まると、メンバーとチャットできます。
              </p>
            )}
          </div>

          {(role === "host" || isAdmin) && (
            <div className="mt-6 text-center">
              {confirmDelete ? (
                <div className="inline-flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
                  イベントを中止して削除しますか？
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await deleteMeetup(id);
                        router.push("/meetups");
                      })
                    }
                    className="rounded-full bg-vermilion px-3 py-1.5 text-white"
                  >
                    削除する
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 text-[color:var(--muted)]">
                    やめる
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)] hover:text-vermilion"
                >
                  <Trash2 size={13} /> イベントを中止する
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-2xl px-4 pb-20 pt-32 sm:px-6">
      <Link
        href="/meetups"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <ArrowLeft size={16} />
        イベント一覧
      </Link>
      {children}
    </section>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-sm font-bold">
      <Icon size={17} className="mt-0.5 shrink-0 text-[color:var(--muted)]" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
