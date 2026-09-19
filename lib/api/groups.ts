import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAt,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Group,
  GroupCategory,
  GroupCover,
  GroupEvent,
  GroupMessage,
  JourneyResult,
} from "@/types";

const MESSAGE_WINDOW = 60;

function nameKey(name: string) {
  return name.trim().toLowerCase();
}
function keywordsOf(name: string): string[] {
  const lower = nameKey(name);
  return [...new Set([lower, ...lower.split(/\s+/).filter(Boolean)])].slice(
    0,
    12,
  );
}

export async function createGroup(
  ownerUid: string,
  name: string,
  emoji: string,
  memberUids: string[],
  opts?: {
    visibility?: "public" | "private";
    about?: string;
    cover?: GroupCover;
    category?: GroupCategory;
  },
): Promise<string | null> {
  if (!db) return null;
  const members = [...new Set([ownerUid, ...memberUids])];
  const trimmed = name.trim();
  const ref = await addDoc(collection(db, "groups"), {
    name: trimmed,
    nameLower: nameKey(trimmed),
    keywords: keywordsOf(trimmed),
    emoji,
    ownerUid,
    members,
    visibility: opts?.visibility ?? "private",
    about: opts?.about?.trim() ?? "",
    cover: opts?.cover ?? "forest",
    category: opts?.category ?? "other",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Browse public groups (for the discover directory, filtered by category
// client-side). Single-field query — no composite index needed.
export async function browsePublicGroups(): Promise<Group[]> {
  if (!db) return [];
  const snapshot = await getDocs(
    query(collection(db, "groups"), where("visibility", "==", "public"), limit(60)),
  );
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<Group, "id">),
  }));
}

// Owner edits name/about/cover/visibility (keeps nameLower in sync so that
// publishing an old private group makes it discoverable).
export async function updateGroupMeta(
  groupId: string,
  patch: Partial<Pick<Group, "name" | "about" | "cover" | "visibility">>,
) {
  if (!db) return;
  const data: Record<string, unknown> = { ...patch };
  if (patch.name != null) {
    const trimmed = patch.name.trim();
    data.name = trimmed;
    data.nameLower = nameKey(trimmed);
    data.keywords = keywordsOf(trimmed);
  }
  await updateDoc(doc(db, "groups", groupId), data);
}

// Prefix search across PUBLIC groups (Firestore has no full-text; this is a
// lexical prefix range on nameLower — matches from the start of the name).
export async function searchPublicGroups(term: string): Promise<Group[]> {
  if (!db) return [];
  const q = nameKey(term);
  if (!q) return [];
  const snapshot = await getDocs(
    query(
      collection(db, "groups"),
      where("visibility", "==", "public"),
      orderBy("nameLower"),
      startAt(q),
      endAt(q + ""),
      limit(20),
    ),
  );
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<Group, "id">),
  }));
}

// Open-join: the rule lets a non-member append only their own uid to members.
export async function joinPublicGroup(groupId: string, uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "groups", groupId), {
    members: arrayUnion(uid),
  });
}

export async function listMyGroups(uid: string): Promise<Group[]> {
  if (!db) return [];
  const snapshot = await getDocs(
    query(collection(db, "groups"), where("members", "array-contains", uid)),
  );
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<Group, "id">),
  }));
}

export async function getGroup(groupId: string): Promise<Group | null> {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "groups", groupId));
  return snapshot.exists()
    ? { id: snapshot.id, ...(snapshot.data() as Omit<Group, "id">) }
    : null;
}

export async function addGroupMembers(groupId: string, uids: string[]) {
  if (!db || !uids.length) return;
  await updateDoc(doc(db, "groups", groupId), {
    members: arrayUnion(...uids),
  });
}

export async function leaveGroup(groupId: string, uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "groups", groupId), {
    members: arrayRemove(uid),
  });
}

export async function deleteGroup(groupId: string) {
  if (!db) return;
  await deleteDoc(doc(db, "groups", groupId));
}

// ---- Chat ----

// Live view of the last messages; returns the unsubscribe function.
export function subscribeGroupMessages(
  groupId: string,
  onMessages: (messages: GroupMessage[]) => void,
): () => void {
  if (!db) return () => {};
  const ref = query(
    collection(db, "groups", groupId, "messages"),
    orderBy("createdAt", "asc"),
    limitToLast(MESSAGE_WINDOW),
  );
  return onSnapshot(ref, (snapshot) => {
    onMessages(
      snapshot.docs.map((entry) => ({
        id: entry.id,
        ...(entry.data() as Omit<GroupMessage, "id">),
      })),
    );
  });
}

export async function sendGroupMessage(
  groupId: string,
  uid: string,
  name: string,
  text: string,
) {
  if (!db) return;
  await addDoc(collection(db, "groups", groupId, "messages"), {
    uid,
    name,
    text,
    createdAt: serverTimestamp(),
  });
}

// ---- Events (joint trips) ----

export function subscribeGroupEvents(
  groupId: string,
  onEvents: (events: GroupEvent[]) => void,
): () => void {
  if (!db) return () => {};
  const ref = query(
    collection(db, "groups", groupId, "events"),
    orderBy("date", "asc"),
  );
  return onSnapshot(ref, (snapshot) => {
    onEvents(
      snapshot.docs.map((entry) => ({
        id: entry.id,
        ...(entry.data() as Omit<GroupEvent, "id">),
      })),
    );
  });
}

export async function createGroupEvent(
  groupId: string,
  createdBy: string,
  createdByName: string,
  date: string,
  journey: JourneyResult,
) {
  if (!db) return;
  await addDoc(collection(db, "groups", groupId, "events"), {
    createdBy,
    createdByName,
    date,
    journey,
    participants: [createdBy],
    createdAt: serverTimestamp(),
  });
}

export async function setEventParticipation(
  groupId: string,
  eventId: string,
  uid: string,
  join: boolean,
) {
  if (!db) return;
  await updateDoc(doc(db, "groups", groupId, "events", eventId), {
    participants: join ? arrayUnion(uid) : arrayRemove(uid),
  });
}

export async function deleteGroupEvent(groupId: string, eventId: string) {
  if (!db) return;
  await deleteDoc(doc(db, "groups", groupId, "events", eventId));
}
