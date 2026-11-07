import type { Meetup, MeetupPerson, TabibitoProfile } from "@/types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// "2026-11-15" + "10:00" → "11/15（日） 10:00"
export function meetupWhen(date: string, time?: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}/${d}（${weekday}）${time ? ` ${time}` : ""}`;
}

export type MeetupRole = "host" | "member" | "pending" | "invited" | "guest";

export function roleOf(meetup: Meetup, uid?: string | null): MeetupRole {
  if (!uid) return "guest";
  if (meetup.hostUid === uid) return "host";
  if (meetup.members.includes(uid)) return "member";
  if (meetup.invites.includes(uid)) return "invited";
  if (meetup.pending.includes(uid)) return "pending";
  return "guest";
}

export const isFull = (meetup: Meetup) => meetup.capacity > 0 && meetup.members.length >= meetup.capacity;
export const isPast = (meetup: Meetup, today: string) => meetup.date < today;

// The one-word status chip a card shows for the viewer.
export function statusChip(
  meetup: Meetup,
  uid: string | null | undefined,
  today: string,
): { label: string; tone: "vermilion" | "forest" | "sun" | "muted" } | null {
  if (isPast(meetup, today)) return { label: "終了", tone: "muted" };
  const role = roleOf(meetup, uid);
  if (role === "host") return { label: "主催", tone: "vermilion" };
  if (role === "member") return { label: "参加予定", tone: "forest" };
  if (role === "invited") return { label: "招待", tone: "sun" };
  if (role === "pending") return { label: "申請中", tone: "sun" };
  if (isFull(meetup)) return { label: "満員", tone: "muted" };
  return null;
}

export function personFrom(profile: TabibitoProfile | null, fallbackName?: string | null): MeetupPerson {
  return {
    name: profile?.displayName?.trim() || fallbackName?.trim() || "旅人",
    ...(profile?.avatarEmoji ? { emoji: profile.avatarEmoji } : {}),
    ...(profile?.avatarColor ? { color: profile.avatarColor } : {}),
  };
}

export function mapsUrl(meetup: Pick<Meetup, "placeName" | "placeLat" | "placeLon">): string | null {
  if (meetup.placeLat != null && meetup.placeLon != null) {
    const name = encodeURIComponent(meetup.placeName ?? "");
    return `https://www.google.com/maps/search/${name}/@${meetup.placeLat},${meetup.placeLon},15z`;
  }
  if (meetup.placeName) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meetup.placeName)}`;
  return null;
}
