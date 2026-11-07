"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { coverCss } from "@/lib/groupCovers";
import { GROUP_CATEGORIES } from "@/lib/groupCategories";
import { meetupWhen, statusChip } from "@/lib/meetupFormat";
import type { Meetup, MeetupPerson } from "@/types";

const toneClass = {
  vermilion: "bg-vermilion text-white",
  forest: "bg-forest text-white",
  sun: "bg-sun text-[#3a2a00]",
  muted: "bg-[color:var(--surface-muted)] text-[color:var(--muted)]",
};

export function PersonAvatar({ person, size = 28 }: { person?: MeetupPerson; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full ring-2 ring-[color:var(--surface)]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        backgroundColor: `color-mix(in srgb, ${person?.color ?? "#285f4d"} 28%, var(--surface))`,
      }}
      title={person?.name}
    >
      {person?.emoji ?? "🐣"}
    </span>
  );
}

// One event in a list: cover tile, title, when/where, who is going.
export function MeetupCard({ meetup, uid, today }: { meetup: Meetup; uid?: string | null; today: string }) {
  const chip = statusChip(meetup, uid, today);
  const host = meetup.people[meetup.hostUid];
  const faces = meetup.members.slice(0, 4);
  return (
    <Link
      href={`/meetups/${meetup.id}`}
      className="flex gap-3 rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface)] p-3 transition hover:border-vermilion/50"
    >
      <span
        className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-4xl shadow-sm"
        style={{ background: coverCss(meetup.cover) }}
      >
        {meetup.emoji ?? GROUP_CATEGORIES[meetup.category]?.emoji ?? "🎒"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-black leading-snug">{meetup.title}</span>
          {chip && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${toneClass[chip.tone]}`}>
              {chip.label}
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-bold text-[color:var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} />
            {meetupWhen(meetup.date, meetup.time)}
          </span>
          {meetup.placeName && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{meetup.placeName}</span>
            </span>
          )}
        </span>
        <span className="mt-2 flex items-center gap-2">
          <span className="flex -space-x-2">
            {faces.map((member) => (
              <PersonAvatar key={member} person={meetup.people[member]} size={24} />
            ))}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--muted)]">
            <Users size={12} />
            {meetup.members.length}
            {meetup.capacity > 0 ? `/${meetup.capacity}` : ""}人
          </span>
          {meetup.official ? (
            <span className="ml-auto rounded-full bg-vermilion/15 px-2 py-0.5 text-[10px] font-black text-vermilion">公式</span>
          ) : (
            host && <span className="ml-auto truncate text-[10px] font-bold text-[color:var(--muted)]">主催 {host.name}</span>
          )}
        </span>
      </span>
    </Link>
  );
}
