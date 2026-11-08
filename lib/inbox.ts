"use client";

import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { useSyncExternalStore } from "react";
import { db } from "@/lib/firebase";

// お知らせ: what happened while you were away, built live from data the app
// already has (event invites, join requests, chats, friend requests, shared
// places) — nothing is written for anyone else. What you have seen and read
// is kept in your own users/{uid}/inbox/state, so it follows you across
// devices. Push notifications build on the same items later.

export type InboxKind = "invite" | "request" | "approved" | "message" | "friend" | "share";

export type InboxItem = {
  // Stable per occurrence: a new chat message gets a new id.
  id: string;
  kind: InboxKind;
  title: string;
  body?: string;
  href: string;
  // ms; for sorting and "3分前".
  at: number;
  meetupId?: string;
};

export type InboxSnapshot = {
  ready: boolean;
  items: InboxItem[];
  seen: ReadonlySet<string>;
  unseen: number;
};

type Persisted = {
  seen: string[];
  // meetupId → when you last had its chat open.
  readAt: Record<string, number>;
  // Events you had asked to join, to notice when the host says yes.
  pending: string[];
  approved: { meetupId: string; title: string; at: number }[];
};

type RawMeetup = {
  id: string;
  title: string;
  date?: string;
  hostUid: string;
  members: string[];
  pending: string[];
  people: Record<string, { name?: string }>;
  createdAt: number;
};

type LastMessage = { id: string; uid: string; name?: string; text: string; at: number };

const EMPTY: InboxSnapshot = { ready: false, items: [], seen: new Set(), unseen: 0 };
const SEEN_LIMIT = 300;
const APPROVED_DAYS = 14;
// Chats you have never opened only count recent messages.
const FRESH_CHAT_MS = 3 * 86_400_000;
// Chats followed at most (recent and upcoming events first).
const CHAT_LIMIT = 20;

let snapshot: InboxSnapshot = EMPTY;
const listeners = new Set<() => void>();

function emit(next: InboxSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInbox(): InboxSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

// The chat on screen right now: its messages are not news.
let activeChat: string | null = null;
let recompute: (() => void) | null = null;

export function setActiveChat(meetupId: string | null) {
  activeChat = meetupId;
  recompute?.();
}

const millis = (value: unknown): number => {
  const stamp = value as { toMillis?: () => number } | null | undefined;
  return typeof stamp?.toMillis === "function" ? stamp.toMillis() : 0;
};

function toMeetup(id: string, data: DocumentData): RawMeetup {
  return {
    id,
    title: (data.title as string) ?? "イベント",
    date: data.date as string | undefined,
    hostUid: data.hostUid as string,
    members: (data.members as string[]) ?? [],
    pending: (data.pending as string[]) ?? [],
    people: (data.people as RawMeetup["people"]) ?? {},
    createdAt: millis(data.createdAt),
  };
}

const clip = (text: string, length = 60) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;

const stateRef = (uid: string) => (db ? doc(db, "users", uid, "inbox", "state") : null);

let currentUid: string | null = null;

async function savePersisted(patch: Partial<Persisted>) {
  const ref = currentUid ? stateRef(currentUid) : null;
  if (!ref) return;
  await setDoc(ref, patch, { merge: true }).catch(() => {});
}

// Starts following everything for one signed-in traveller; returns stop.
export function startInbox(uid: string): () => void {
  if (!db) return () => {};
  const firestore = db;
  currentUid = uid;

  let persisted: Persisted | null = null;
  let invites: RawMeetup[] | null = null;
  let joined: RawMeetup[] | null = null;
  let pendingIds: string[] | null = null;
  let friendRequests: InboxItem[] | null = null;
  let shares: InboxItem[] | null = null;
  const lastMessages = new Map<string, LastMessage | null>();
  const chatWatchers = new Map<string, Unsubscribe>();
  // When each condition-type item (no timestamp of its own) was first seen.
  const firstSeen = new Map<string, number>();
  let checkingApprovals = false;

  const since = (id: string) => {
    if (!firstSeen.has(id)) firstSeen.set(id, Date.now());
    return firstSeen.get(id)!;
  };

  function build() {
    if (!persisted || !invites || !joined || !friendRequests || !shares) {
      emit({ ...EMPTY });
      return;
    }
    const items: InboxItem[] = [];
    for (const meetup of invites) {
      const host = meetup.people[meetup.hostUid]?.name ?? "旅人";
      items.push({
        id: `invite:${meetup.id}`,
        kind: "invite",
        title: `「${meetup.title}」に招待されました`,
        body: `${host}さんから`,
        href: `/meetups/${meetup.id}`,
        at: meetup.createdAt || since(`invite:${meetup.id}`),
        meetupId: meetup.id,
      });
    }
    for (const meetup of joined) {
      if (meetup.hostUid === uid) {
        for (const asker of meetup.pending) {
          const id = `request:${meetup.id}:${asker}`;
          items.push({
            id,
            kind: "request",
            title: `${meetup.people[asker]?.name ?? "旅人"}さんが参加したいそうです`,
            body: `「${meetup.title}」`,
            href: `/meetups/${meetup.id}`,
            at: since(id),
            meetupId: meetup.id,
          });
        }
      }
      const last = lastMessages.get(meetup.id);
      const readAt = persisted.readAt[meetup.id];
      if (
        last &&
        last.uid !== uid &&
        meetup.id !== activeChat &&
        (readAt ? last.at > readAt : Date.now() - last.at < FRESH_CHAT_MS)
      ) {
        items.push({
          id: `message:${meetup.id}:${last.id}`,
          kind: "message",
          title: `「${meetup.title}」に新しいメッセージ`,
          body: clip(`${last.name ?? "旅人"}：${last.text}`),
          href: `/meetups/${meetup.id}`,
          at: last.at,
          meetupId: meetup.id,
        });
      }
    }
    const cutoff = Date.now() - APPROVED_DAYS * 86_400_000;
    for (const entry of persisted.approved) {
      if (entry.at < cutoff) continue;
      items.push({
        id: `approved:${entry.meetupId}:${entry.at}`,
        kind: "approved",
        title: `「${entry.title}」への参加が決まりました`,
        body: "主催者が承認しました",
        href: `/meetups/${entry.meetupId}`,
        at: entry.at,
        meetupId: entry.meetupId,
      });
    }
    items.push(...friendRequests, ...shares);
    items.sort((a, b) => b.at - a.at);
    const seen = new Set(persisted.seen);
    emit({
      ready: true,
      items,
      seen,
      unseen: items.filter((item) => !seen.has(item.id)).length,
    });
  }
  recompute = build;

  // A request that left `pending`: approved if you are now a member.
  async function checkApprovals() {
    if (checkingApprovals || !persisted || !pendingIds || !joined) return;
    const now = new Set(pendingIds);
    const gone = persisted.pending.filter((id) => !now.has(id));
    const added = pendingIds.some((id) => !persisted!.pending.includes(id));
    if (!gone.length && !added) return;
    checkingApprovals = true;
    try {
      const approved: Persisted["approved"] = [];
      for (const id of gone) {
        const meetup =
          joined.find((item) => item.id === id) ??
          (await getDoc(doc(firestore, "meetups", id))
            .then((entry) => (entry.exists() ? toMeetup(entry.id, entry.data()) : null))
            .catch(() => null));
        if (meetup?.members.includes(uid)) {
          approved.push({ meetupId: id, title: meetup.title, at: Date.now() });
        }
      }
      await savePersisted({
        pending: [...now],
        ...(approved.length
          ? { approved: [...persisted.approved, ...approved].slice(-20) }
          : {}),
      });
    } finally {
      checkingApprovals = false;
    }
  }

  // Follow the latest message of each event you're in.
  function syncChatWatchers() {
    if (!joined) return;
    const today = new Date(Date.now() + 9 * 3600_000 - 7 * 86_400_000).toISOString().slice(0, 10);
    const wanted = joined
      .filter((meetup) => !meetup.date || meetup.date >= today)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      .slice(0, CHAT_LIMIT)
      .map((meetup) => meetup.id);
    for (const [id, stop] of chatWatchers) {
      if (!wanted.includes(id)) {
        stop();
        chatWatchers.delete(id);
        lastMessages.delete(id);
      }
    }
    for (const id of wanted) {
      if (chatWatchers.has(id)) continue;
      chatWatchers.set(
        id,
        onSnapshot(
          query(collection(firestore, "meetups", id, "messages"), orderBy("createdAt", "desc"), limit(1)),
          (result) => {
            const entry = result.docs[0];
            const data = entry?.data();
            const at = millis(data?.createdAt);
            lastMessages.set(
              id,
              entry && at
                ? { id: entry.id, uid: data!.uid, name: data!.name, text: data!.text ?? "", at }
                : null,
            );
            build();
          },
          () => {
            lastMessages.set(id, null);
            build();
          },
        ),
      );
    }
  }

  const meetups = collection(firestore, "meetups");
  const stops: Unsubscribe[] = [
    onSnapshot(
      stateRef(uid)!,
      (entry) => {
        const data = (entry.data() ?? {}) as Partial<Persisted>;
        persisted = {
          seen: data.seen ?? [],
          readAt: data.readAt ?? {},
          pending: data.pending ?? [],
          approved: data.approved ?? [],
        };
        build();
        void checkApprovals();
      },
      () => {
        persisted = { seen: [], readAt: {}, pending: [], approved: [] };
        build();
      },
    ),
    onSnapshot(
      query(meetups, where("invites", "array-contains", uid), limit(50)),
      (result) => {
        invites = result.docs.map((entry) => toMeetup(entry.id, entry.data()));
        build();
      },
      () => {
        invites = [];
        build();
      },
    ),
    onSnapshot(
      query(meetups, where("members", "array-contains", uid), limit(100)),
      (result) => {
        joined = result.docs.map((entry) => toMeetup(entry.id, entry.data()));
        syncChatWatchers();
        build();
        void checkApprovals();
      },
      () => {
        joined = [];
        build();
      },
    ),
    onSnapshot(
      query(meetups, where("pending", "array-contains", uid), limit(50)),
      (result) => {
        pendingIds = result.docs.map((entry) => entry.id);
        void checkApprovals();
      },
      () => {
        pendingIds = null;
      },
    ),
    onSnapshot(
      query(collection(firestore, "friendRequests"), where("toUid", "==", uid)),
      (result) => {
        friendRequests = result.docs.map((entry) => {
          const data = entry.data();
          return {
            id: `friend:${entry.id}`,
            kind: "friend" as const,
            title: `${(data.fromName as string) || "旅人"}さんからなかま申請`,
            body: "なかまのページで承認できます",
            href: "/friends",
            at: millis(data.createdAt) || since(`friend:${entry.id}`),
          };
        });
        build();
      },
      () => {
        friendRequests = [];
        build();
      },
    ),
    onSnapshot(
      query(collection(firestore, "sharedCards"), where("toUid", "==", uid)),
      (result) => {
        shares = result.docs.map((entry) => {
          const data = entry.data();
          const place = (data.journey as { destination?: { name?: string } } | undefined)?.destination
            ?.name;
          return {
            id: `share:${entry.id}`,
            kind: "share" as const,
            title: `${(data.fromName as string) || "旅人"}さんが旅先をシェアしました`,
            body: place ? clip(place) : undefined,
            href: "/friends",
            at: millis(data.createdAt) || since(`share:${entry.id}`),
          };
        });
        build();
      },
      () => {
        shares = [];
        build();
      },
    ),
  ];

  return () => {
    for (const stop of stops) stop();
    for (const stop of chatWatchers.values()) stop();
    chatWatchers.clear();
    recompute = null;
    currentUid = null;
    emit(EMPTY);
  };
}

// Everything listed now counts as seen (the bell was opened).
export function markInboxSeen(match?: (item: InboxItem) => boolean) {
  const { items, seen } = snapshot;
  const fresh = items.filter((item) => !seen.has(item.id) && (!match || match(item)));
  if (!fresh.length) return;
  const next = [...seen, ...fresh.map((item) => item.id)].slice(-SEEN_LIMIT);
  // Show it at once; the saved state follows.
  emit({ ...snapshot, seen: new Set(next), unseen: snapshot.unseen - fresh.length });
  void savePersisted({ seen: next });
}

// You have read this event's chat up to its latest message (its server
// time, so a phone with a wrong clock can't hide or resurface messages).
const lastRead = new Map<string, number>();
export function markChatRead(meetupId: string, latestAt: number) {
  const ref = currentUid ? stateRef(currentUid) : null;
  if (!ref || !latestAt || (lastRead.get(meetupId) ?? 0) >= latestAt) return;
  lastRead.set(meetupId, latestAt);
  void setDoc(ref, { readAt: { [meetupId]: latestAt } }, { merge: true }).catch(() => {});
}
