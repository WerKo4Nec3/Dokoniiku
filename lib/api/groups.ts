import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Group,
  GroupEvent,
  GroupMessage,
  JourneyResult,
} from "@/types";

const MESSAGE_WINDOW = 60;

export async function createGroup(
  ownerUid: string,
  name: string,
  emoji: string,
  memberUids: string[],
): Promise<string | null> {
  if (!db) return null;
  const members = [...new Set([ownerUid, ...memberUids])];
  const ref = await addDoc(collection(db, "groups"), {
    name,
    emoji,
    ownerUid,
    members,
    createdAt: serverTimestamp(),
  });
  return ref.id;
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
