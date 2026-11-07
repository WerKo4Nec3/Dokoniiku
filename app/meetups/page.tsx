"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchProfile } from "@/lib/api/profile";
import { listMyGroups } from "@/lib/api/groups";
import {
  acceptInvite,
  browsePublicMeetups,
  declineInvite,
  listInvitedMeetups,
  listJoinedMeetups,
  listRequestedMeetups,
  todayJst,
} from "@/lib/api/meetups";
import { GROUP_CATEGORIES, GROUP_CATEGORY_KEYS } from "@/lib/groupCategories";
import { isPast, meetupWhen, personFrom } from "@/lib/meetupFormat";
import { openAuthDialog } from "@/components/AuthDialog";
import { CabinetHeader } from "@/components/CabinetHeader";
import { MeetupCard, PersonAvatar } from "@/components/meetups/MeetupCard";
import type { GroupCategory, Meetup, TabibitoProfile } from "@/types";

type Tab = "find" | "mine";

const byDate = (a: Meetup, b: Meetup) =>
  a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");

export default function MeetupsPage() {
  const router = useRouter();
  const { enabled, loading, user } = useAuth();
  const [today, setToday] = useState("");
  const [tab, setTab] = useState<Tab>("find");
  const [publicList, setPublicList] = useState<Meetup[] | null>(null);
  const [joined, setJoined] = useState<Meetup[]>([]);
  const [requested, setRequested] = useState<Meetup[]>([]);
  const [invited, setInvited] = useState<Meetup[]>([]);
  const [groupCount, setGroupCount] = useState(0);
  const [profile, setProfile] = useState<TabibitoProfile | null>(null);
  const [category, setCategory] = useState<GroupCategory | "all">("all");
  const [term, setTerm] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(todayJst()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const guard = <T,>(set: (value: T) => void) => (value: T) => {
      if (active) set(value);
    };
    browsePublicMeetups().then(guard(setPublicList)).catch(() => active && setPublicList([]));
    listJoinedMeetups(user.uid).then(guard(setJoined)).catch(() => {});
    listRequestedMeetups(user.uid).then(guard(setRequested)).catch(() => {});
    listInvitedMeetups(user.uid).then(guard(setInvited)).catch(() => {});
    listMyGroups(user.uid).then((groups) => active && setGroupCount(groups.length)).catch(() => {});
    fetchProfile(user.uid).then(guard(setProfile)).catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  // Official first, then the soonest; past events drop off the directory.
  const directory = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (publicList ?? [])
      .filter((meetup) => today && !isPast(meetup, today))
      .filter((meetup) => category === "all" || meetup.category === category)
      .filter((meetup) => !q || meetup.title.toLowerCase().includes(q) || meetup.placeName?.toLowerCase().includes(q))
      .sort((a, b) => Number(Boolean(b.official)) - Number(Boolean(a.official)) || byDate(a, b));
  }, [publicList, today, category, term]);

  const upcoming = joined.filter((meetup) => today && !isPast(meetup, today)).sort(byDate);
  const past = joined.filter((meetup) => today && isPast(meetup, today)).sort((a, b) => byDate(b, a));
  const waiting = requested.filter((meetup) => today && !isPast(meetup, today)).sort(byDate);
  const invites = invited.filter((meetup) => today && !isPast(meetup, today)).sort(byDate);

  async function respond(meetup: Meetup, accept: boolean) {
    if (!user) return;
    setBusyId(meetup.id);
    try {
      if (accept) {
        await acceptInvite(meetup.id, user.uid, personFrom(profile, user.displayName));
        router.push(`/meetups/${meetup.id}`);
      } else {
        await declineInvite(meetup.id, user.uid);
        setInvited((current) => current.filter((item) => item.id !== meetup.id));
      }
    } finally {
      setBusyId(null);
    }
  }

  const tabButton = (id: Tab, text: string, count?: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      className={`flex-1 rounded-full px-4 py-2 text-sm font-black transition ${
        tab === id ? "bg-[color:var(--foreground)] text-[color:var(--background)]" : "text-[color:var(--muted)]"
      }`}
    >
      {text}
      {count ? <span className="ml-1 text-xs opacity-70">{count}</span> : null}
    </button>
  );

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader title="イベント" subtitle="旅を企画して、なかまや旅人と一緒に出かけよう。" />

      {!enabled && (
        <p className="mt-6 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
          アカウント機能は現在設定されていません。
        </p>
      )}

      {enabled && !loading && !user && (
        <div className="mt-6 rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-3xl">🎪</p>
          <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
            ログインすると、イベントを探したり主催したりできます。
          </p>
          <button
            type="button"
            onClick={() => openAuthDialog()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-vermilion px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            ログイン / 新規登録
          </button>
        </div>
      )}

      {enabled && user && (
        <div className="space-y-5 sm:mt-6">
          <Link
            href="/meetups/new"
            className="flex items-center justify-center gap-2 rounded-[22px] bg-vermilion px-5 py-3.5 text-sm font-black text-white shadow-float transition hover:opacity-90"
          >
            <Plus size={18} />
            イベントをつくる
          </Link>

          {invites.length > 0 && (
            <div className="space-y-2 rounded-[22px] border-2 border-sun/60 bg-sun/10 p-3">
              <p className="px-1 text-xs font-black text-[#8c6702] dark:text-sun">📨 招待が届いています</p>
              {invites.map((meetup) => {
                const host = meetup.people[meetup.hostUid];
                return (
                  <div key={meetup.id} className="rounded-2xl bg-[color:var(--surface)] p-3">
                    <Link href={`/meetups/${meetup.id}`} className="flex items-center gap-3">
                      <PersonAvatar person={host} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{meetup.title}</span>
                        <span className="block truncate text-[11px] font-bold text-[color:var(--muted)]">
                          {host?.name ?? "旅人"}さんから ・ {meetupWhen(meetup.date, meetup.time)}
                        </span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[color:var(--muted)]" />
                    </Link>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === meetup.id}
                        onClick={() => respond(meetup, true)}
                        className="flex-1 rounded-full bg-forest px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                      >
                        参加する
                      </button>
                      <button
                        type="button"
                        disabled={busyId === meetup.id}
                        onClick={() => respond(meetup, false)}
                        className="rounded-full border border-[color:var(--line)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] disabled:opacity-60"
                      >
                        今回は見送る
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-1 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] p-1">
            {tabButton("find", "さがす")}
            {tabButton("mine", "わたしの予定", upcoming.length + waiting.length)}
          </div>

          {tab === "find" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2.5">
                <Search size={16} className="text-[color:var(--muted)]" />
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="イベント名・場所でさがす"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                />
              </label>
              <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
                {(["all", ...GROUP_CATEGORY_KEYS] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={category === key}
                    onClick={() => setCategory(key)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      category === key
                        ? "border-vermilion bg-vermilion/10 text-vermilion"
                        : "border-[color:var(--line)] text-[color:var(--muted)]"
                    }`}
                  >
                    {key === "all" ? "すべて" : `${GROUP_CATEGORIES[key].emoji} ${GROUP_CATEGORIES[key].label}`}
                  </button>
                ))}
              </div>
              {publicList === null ? (
                <p className="py-8 text-center text-xs font-bold text-[color:var(--muted)]">読み込み中…</p>
              ) : directory.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[color:var(--line)] p-8 text-center">
                  <p className="text-3xl">🗺️</p>
                  <p className="mt-2 text-sm font-bold">まだ公開イベントがありません</p>
                  <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                    最初のイベントをつくって、旅の仲間を集めよう。
                  </p>
                </div>
              ) : (
                directory.map((meetup) => <MeetupCard key={meetup.id} meetup={meetup} uid={user.uid} today={today} />)
              )}
            </div>
          )}

          {tab === "mine" && (
            <div className="space-y-5">
              <List title="参加予定" items={upcoming} uid={user.uid} today={today} empty="予定しているイベントはまだありません。" />
              {waiting.length > 0 && <List title="承認待ち" items={waiting} uid={user.uid} today={today} />}
              {past.length > 0 && <List title="おわったイベント" items={past} uid={user.uid} today={today} />}
            </div>
          )}

          {groupCount > 0 && (
            <Link
              href="/groups"
              className="flex items-center justify-between rounded-[22px] border border-[color:var(--line)] px-4 py-3 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
            >
              以前のグループ（{groupCount}）
              <ChevronRight size={15} />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function List({
  title,
  items,
  uid,
  today,
  empty,
}: {
  title: string;
  items: Meetup[];
  uid: string;
  today: string;
  empty?: string;
}) {
  return (
    <div className="space-y-2.5">
      <h2 className="text-xs font-black tracking-[0.18em] text-[color:var(--muted)]">{title}</h2>
      {items.length === 0 && empty ? (
        <p className="rounded-[22px] border border-dashed border-[color:var(--line)] p-6 text-center text-xs font-medium text-[color:var(--muted)]">
          {empty}
        </p>
      ) : (
        items.map((meetup) => <MeetupCard key={meetup.id} meetup={meetup} uid={uid} today={today} />)
      )}
    </div>
  );
}
