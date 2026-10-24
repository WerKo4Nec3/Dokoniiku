"use client";

import dynamic from "next/dynamic";
import { ExternalLink, LocateFixed, Radio, Square, Users } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CabinetHeader } from "@/components/CabinetHeader";
import { openAuthDialog } from "@/components/AuthDialog";
import type { LivePoint } from "@/components/live/LiveMap";
import { useAuth } from "@/lib/auth/AuthProvider";
import { subscribeMine, subscribeSharedWithMe } from "@/lib/api/liveLocation";
import { listFriendProfiles } from "@/lib/api/social";
import { SHARE_DURATIONS, minutesLeft, startLiveShare, stopLiveShare, useLiveShare } from "@/lib/live";
import { preciseDistanceKm } from "@/lib/utils/travel";
import type { LiveLocation, PublicProfile } from "@/types";

const LiveMap = dynamic(() => import("@/components/live/LiveMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[color:var(--surface-muted)]" />,
});

// A coarse "now" that ticks every 15s (for "3分前" labels).
function subscribeTick(onTick: () => void) {
  const id = window.setInterval(onTick, 15000);
  return () => window.clearInterval(id);
}
const tickSnapshot = () => Math.floor(Date.now() / 15000) * 15000;
const useNow = () => useSyncExternalStore(subscribeTick, tickSnapshot, () => 0);

function ago(ms: number, now: number) {
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  return minutes < 1 ? "いま" : minutes < 60 ? `${minutes}分前` : `${Math.round(minutes / 60)}時間前`;
}

export default function LivePage() {
  const { enabled, loading, user } = useAuth();
  const session = useLiveShare();
  const now = useNow();
  const [friends, setFriends] = useState<PublicProfile[] | null>(null);
  const [shared, setShared] = useState<LiveLocation[]>([]);
  const [mine, setMine] = useState<LiveLocation | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [minutes, setMinutes] = useState<number>(60);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    listFriendProfiles(user.uid)
      .then((list) => {
        if (active) setFriends(list);
      })
      .catch(() => {
        if (active) setFriends([]);
      });
    const stopShared = subscribeSharedWithMe(user.uid, setShared);
    const stopMine = subscribeMine(user.uid, setMine);
    return () => {
      active = false;
      stopShared();
      stopMine();
    };
  }, [user]);

  // Everyone is ticked by default.
  const chosen = useMemo(
    () => picked ?? new Set((friends ?? []).map((friend) => friend.uid)),
    [picked, friends],
  );

  const points: LivePoint[] = useMemo(() => {
    const list: LivePoint[] = shared.map((item) => ({ ...item, label: item.heading ? `${item.heading}へ` : undefined }));
    if (session && mine && mine.expiresAt > now) list.push({ ...mine, me: true });
    return list;
  }, [shared, mine, session, now]);

  if (!loading && enabled && !user) {
    return (
      <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-20 pt-32 sm:px-6">
        <CabinetHeader eyebrow="なかまの居場所" title="いまどこ" mascot="walking" accent="sky" />
        <button
          type="button"
          onClick={openAuthDialog}
          className="scene-cta mt-6 w-full justify-center"
        >
          ログインして使う
        </button>
      </section>
    );
  }

  function toggle(uid: string) {
    const next = new Set(chosen);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setPicked(next);
  }

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader
        eyebrow="なかまの居場所"
        title="いまどこ"
        subtitle="選んだ仲間にだけ、決めた時間だけ現在地をシェア。アプリを開いている間だけ更新されます。"
        mascot="walking"
        accent="sky"
      />

      <div className="relative isolate mt-6 h-[52vh] min-h-72 overflow-hidden rounded-[28px] border border-[color:var(--line)] shadow-float">
        <LiveMap points={points} focus={focus} />
        {!points.length && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[500] rounded-2xl bg-[color:color-mix(in_srgb,var(--surface)_90%,transparent)] px-4 py-3 text-center text-xs font-bold text-[color:var(--muted)]">
            まだ誰も現在地をシェアしていません
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
          <h2 className="flex items-center gap-2 text-sm font-black">
            <LocateFixed size={16} className="text-vermilion" /> あなたの現在地
          </h2>
          {session ? (
            <div className="mt-4 space-y-3">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className="relative grid h-8 w-8 place-items-center rounded-full bg-vermilion text-white">
                  <Radio size={15} className="animate-pulse" />
                </span>
                共有中・あと約{now ? minutesLeft(session, now) : "–"}分
              </p>
              <p className="text-xs text-[color:var(--muted)]">
                見られる人：
                {(friends ?? [])
                  .filter((friend) => session.viewers.includes(friend.uid))
                  .map((friend) => friend.displayName || "旅人")
                  .join("、") || `${session.viewers.length}人`}
              </p>
              {mine && <p className="text-[11px] text-[color:var(--muted)]">最終送信：{ago(mine.updatedAt, now)}</p>}
              <button
                type="button"
                onClick={stopLiveShare}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-5 py-2.5 text-sm font-bold transition hover:border-vermilion"
              >
                <Square size={14} className="fill-current" /> 共有をやめる
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-bold text-[color:var(--muted)]">見せる仲間</p>
                {friends === null ? (
                  <p className="mt-2 text-xs text-[color:var(--muted)]">読み込み中…</p>
                ) : friends.length === 0 ? (
                  <p className="mt-2 text-xs text-[color:var(--muted)]">
                    まだ仲間がいません。「なかま」アプリでつながろう。
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {friends.map((friend) => {
                      const on = chosen.has(friend.uid);
                      return (
                        <button
                          key={friend.uid}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(friend.uid)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                            on
                              ? "border-vermilion bg-vermilion/10 text-vermilion"
                              : "border-[color:var(--line)] text-[color:var(--muted)]"
                          }`}
                        >
                          <span>{friend.avatarEmoji ?? "🧳"}</span>
                          {friend.displayName || "旅人"}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-[color:var(--muted)]">共有する時間</p>
                <div className="mt-2 inline-flex rounded-full bg-[color:var(--surface-muted)] p-1 text-xs font-bold">
                  {SHARE_DURATIONS.map((option) => (
                    <button
                      key={option.minutes}
                      type="button"
                      aria-pressed={minutes === option.minutes}
                      onClick={() => setMinutes(option.minutes)}
                      className={`rounded-full px-4 py-2 transition ${
                        minutes === option.minutes
                          ? "bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-sm"
                          : "text-[color:var(--muted)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={!chosen.size}
                onClick={() => startLiveShare([...chosen], minutes)}
                className="scene-cta w-full justify-center"
              >
                <Radio size={16} /> 現在地をシェアする
              </button>
              <p className="text-[11px] leading-5 text-[color:var(--muted)]">
                位置は選んだ仲間だけが見られ、時間が来ると自動で消えます。ブラウザを閉じると更新は止まります。
              </p>
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
          <h2 className="flex items-center gap-2 text-sm font-black">
            <Users size={16} className="text-vermilion" /> シェアしてくれている仲間
          </h2>
          {shared.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--muted)]">いまは誰もシェアしていません。</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {shared.map((item) => {
                const km = mine ? preciseDistanceKm({ latitude: mine.lat, longitude: mine.lon }, { latitude: item.lat, longitude: item.lon }) : null;
                return (
                  <li key={item.uid} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFocus(item.uid)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg"
                      style={{ backgroundColor: item.avatarColor ?? "var(--surface-muted)" }}
                      aria-label={`${item.name}を地図で見る`}
                    >
                      {item.avatarEmoji ?? "🧳"}
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{item.name}</span>
                      <span className="block truncate text-[11px] text-[color:var(--muted)]">
                        {ago(item.updatedAt, now)}更新
                        {km !== null && `・あなたから約${km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}`}
                        {item.heading && `・${item.heading}へ向かっています`}
                      </span>
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Google Mapsで開く"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--line)]"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
