"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Check, Clock, Loader2, MapPin, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchProfile } from "@/lib/api/profile";
import {
  getPublicProfile,
  hasSentFriendRequest,
  isFriendWith,
  sendFriendRequest,
} from "@/lib/api/social";
import { prefectures } from "@/data/prefectures";
import { normalizePhotoUrl } from "@/lib/photos";
import { displayPlaceName } from "@/lib/utils/travel";
import { openAuthDialog } from "@/components/AuthDialog";
import { CategoryArt } from "@/components/journey/CategoryCard";
import { ConquestMiniMap } from "@/components/profile/ConquestMiniMap";
import { AVATAR_COLORS } from "@/components/profile/ProfileEditor";
import type { PublicProfile } from "@/types";

type Relation = "me" | "friend" | "sent" | "none";

const prefectureName = (id: string) => prefectures.find((item) => item.id === id)?.nameJa ?? "";

function visitLabel(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

// Another traveller's タビ手帳, as far as they share it: name, level, how
// much of Japan they've conquered and their latest places. Profiles are
// readable by any signed-in traveller (firestore.rules: /profiles).
export default function TravellerPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  const router = useRouter();
  const { enabled, loading, user } = useAuth();
  const [person, setPerson] = useState<PublicProfile | null | undefined>(undefined);
  // How you stand with them (null while checking); "me" on your own page.
  const [friendship, setFriendship] = useState<Exclude<Relation, "me"> | null>(null);
  const relation: Relation | null = user && uid === user.uid ? "me" : friendship;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getPublicProfile(uid)
      .then((found) => active && setPerson(found))
      .catch(() => active && setPerson(null));
    if (uid !== user.uid) {
      Promise.all([isFriendWith(user.uid, uid), hasSentFriendRequest(user.uid, uid)])
        .then(([friend, sent]) => active && setFriendship(friend ? "friend" : sent ? "sent" : "none"))
        .catch(() => active && setFriendship("none"));
    }
    return () => {
      active = false;
    };
  }, [uid, user]);

  async function requestFriend() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const mine = await fetchProfile(user.uid).catch(() => null);
      await sendFriendRequest(user.uid, uid, mine?.displayName ?? user.displayName ?? undefined);
      setFriendship("sent");
    } catch {
      setError("申請を送れませんでした。少し時間をおいて試してね。");
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/friends"))}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
    >
      <ArrowLeft size={16} />
      もどる
    </button>
  );

  if (!enabled) {
    return (
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6">
        <p className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
          アカウント機能は現在設定されていません。
        </p>
      </section>
    );
  }

  if (!loading && !user) {
    return (
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6">
        {back}
        <div className="rounded-[28px] border-2 border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm font-medium text-[color:var(--muted)]">
            ログインすると、旅人のプロフィールを見られます。
          </p>
          <button type="button" onClick={() => openAuthDialog()} className="btn-3d btn-3d-forest mt-4">
            ログイン / 新規登録
          </button>
        </div>
      </section>
    );
  }

  if (person === undefined) {
    return (
      <section className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4 pt-32">
        <Loader2 size={28} className="animate-spin text-[color:var(--muted)]" />
      </section>
    );
  }

  if (person === null) {
    return (
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6">
        {back}
        <p className="rounded-[28px] border-2 border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center text-sm font-medium text-[color:var(--muted)]">
          この旅人は見つかりませんでした。
        </p>
      </section>
    );
  }

  const color = person.avatarColor ?? AVATAR_COLORS[0];
  const name = person.displayName?.trim() || "名もなき旅人";
  const conquered = person.prefectureIds ?? [];
  const places = person.recentPlaces ?? [];
  const hasStats = person.level != null;

  const action =
    relation === "me" ? (
      <Link href="/profile" className="btn-3d btn-3d-plain w-full">
        自分のタビ手帳を開く
      </Link>
    ) : relation === "friend" ? (
      <span className="btn-3d btn-3d-plain w-full cursor-default text-forest dark:text-forest-ink">
        <Check size={18} strokeWidth={3} /> なかま
      </span>
    ) : relation === "sent" ? (
      <span className="btn-3d btn-3d-plain w-full cursor-default text-[color:var(--muted)]">
        <Clock size={18} /> 申請中
      </span>
    ) : relation === "none" ? (
      <button type="button" onClick={requestFriend} disabled={busy} className="btn-3d btn-3d-forest w-full">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
        なかま申請
      </button>
    ) : null;

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-24 pt-32 sm:px-6">
      {back}

      <div className="overflow-clip rounded-[28px] border-2 border-[color:var(--line)] bg-[color:var(--surface)]">
        <div
          className="grid h-44 place-items-center"
          style={{
            background: `radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, ${color} 55%, transparent), transparent 70%), linear-gradient(160deg, color-mix(in srgb, ${color} 35%, var(--surface)), color-mix(in srgb, ${color} 12%, var(--surface)))`,
          }}
        >
          <span
            className="grid h-28 w-28 place-items-center rounded-full text-6xl shadow-float ring-4 ring-white/30"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 30%, var(--surface))` }}
          >
            {person.avatarEmoji ?? "🐣"}
          </span>
        </div>
        <div className="px-5 pb-5 pt-4 sm:px-7">
          <h1 className="break-words font-display text-[1.75rem] font-bold leading-tight">{name}</h1>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[color:var(--muted)]">
            @{person.friendCode}
          </p>
          {hasStats && (
            <span
              className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black text-white"
              style={{ backgroundColor: color }}
            >
              Lv.{person.level} {person.levelTitle}
            </span>
          )}
          {person.bio && (
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--muted)]">{person.bio}</p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {[
              { emoji: "🗾", value: `${conquered.length}`, label: "都道府県" },
              { emoji: "📍", value: `${person.visitedCount ?? 0}`, label: "行った場所" },
              { emoji: "🏅", value: `${person.medals ?? 0}`, label: "メダル" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border-2 border-b-4 border-[color:var(--line)] px-2 py-3 text-center"
              >
                <span className="block text-xl leading-none">{stat.emoji}</span>
                <span className="mt-1.5 block text-xl font-black tabular-nums">{stat.value}</span>
                <span className="block text-[11px] font-bold text-[color:var(--muted)]">{stat.label}</span>
              </div>
            ))}
          </div>

          {action && <div className="mt-4">{action}</div>}
          {error && <p className="mt-2 text-xs font-bold text-[color:var(--brand-ink)]">{error}</p>}
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border-2 border-[color:var(--line)] bg-[color:var(--surface)] p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-black tracking-[0.18em] text-[color:var(--muted)]">制覇マップ</h2>
          <span className="text-sm font-black tabular-nums">
            {conquered.length}
            <span className="text-xs text-[color:var(--muted)]">/47</span>
          </span>
        </div>
        <div className="mx-auto mt-3 aspect-square w-full max-w-sm">
          <ConquestMiniMap prefectureIds={conquered} accent={color} />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-black tracking-[0.18em] text-[color:var(--muted)]">最近の旅</h2>
        {places.length === 0 ? (
          <p className="rounded-[28px] border-2 border-dashed border-[color:var(--line)] p-6 text-center text-sm font-medium text-[color:var(--muted)]">
            {hasStats
              ? "まだ「行った」場所はないみたい。"
              : "旅の記録はまだ公開されていません。本人がアプリを開くと表示されるよ。"}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {places.map((place, index) => (
              <li
                key={`${place.name}-${index}`}
                className="flex items-center gap-3 rounded-2xl border-2 border-b-4 border-[color:var(--line)] bg-[color:var(--surface)] p-2.5"
              >
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  {place.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={normalizePhotoUrl(place.imageUrl)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <CategoryArt category={place.category ?? "nature"} className="h-full w-full" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">{displayPlaceName(place.name)}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[color:var(--muted)]">
                    <MapPin size={11} />
                    {prefectureName(place.prefectureId)}
                    {place.at ? ` ・ ${visitLabel(place.at)}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
