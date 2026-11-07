"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useUserJourneys } from "@/lib/hooks/cabinet";
import { checkAdmin } from "@/lib/api/admin";
import { fetchProfile } from "@/lib/api/profile";
import { listFriendProfiles } from "@/lib/api/social";
import { createMeetup, todayJst } from "@/lib/api/meetups";
import { personFrom } from "@/lib/meetupFormat";
import { displayPlaceName } from "@/lib/utils/travel";
import { openAuthDialog } from "@/components/AuthDialog";
import { CabinetHeader } from "@/components/CabinetHeader";
import { MeetupForm, type SavedPlace } from "@/components/meetups/MeetupForm";
import type { PublicProfile, TabibitoProfile } from "@/types";

export default function NewMeetupPage() {
  const router = useRouter();
  const { enabled, loading, user, journeys } = useUserJourneys();
  const [today, setToday] = useState("");
  const [profile, setProfile] = useState<TabibitoProfile | null>(null);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(todayJst()), 0);
    return () => window.clearTimeout(timer);
  }, []);

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

  // Places from the 旅ノート, newest first, one per destination.
  const places = useMemo<SavedPlace[]>(() => {
    const seen = new Set<string>();
    const out: SavedPlace[] = [];
    for (const journey of journeys ?? []) {
      const destination = journey.destination;
      if (seen.has(destination.id)) continue;
      seen.add(destination.id);
      out.push({
        id: destination.id,
        name: displayPlaceName(destination.name),
        prefecture: journey.prefecture.nameJa,
        latitude: destination.latitude,
        longitude: destination.longitude,
      });
    }
    return out;
  }, [journeys]);

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-xl px-4 pb-20 pt-32 sm:px-6">
      <Link
        href="/meetups"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <ArrowLeft size={16} />
        イベント一覧
      </Link>
      <div className="mt-3">
        <CabinetHeader title="イベントをつくる" />
      </div>
      <h2 className="text-xl font-black sm:hidden">イベントをつくる</h2>

      {enabled && !loading && !user && (
        <div className="mt-6 rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm font-medium text-[color:var(--muted)]">ログインするとイベントをつくれます。</p>
          <button
            type="button"
            onClick={() => openAuthDialog()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-vermilion px-5 py-2.5 text-sm font-bold text-white"
          >
            ログイン / 新規登録
          </button>
        </div>
      )}

      {user && today && (
        <div className="mt-5 rounded-[26px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
          <MeetupForm
            today={today}
            places={places}
            friends={friends}
            canOfficial={isAdmin}
            submitLabel="イベントを公開する"
            onSubmit={async (draft, invitees) => {
              const id = await createMeetup(
                { uid: user.uid, person: personFrom(profile, user.displayName) },
                draft,
                invitees.map((friend) => ({
                  uid: friend.uid,
                  person: personFrom(friend, "旅人"),
                })),
              );
              if (id) router.push(`/meetups/${id}`);
            }}
          />
        </div>
      )}
    </section>
  );
}
