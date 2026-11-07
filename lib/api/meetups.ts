import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GroupMessage, Meetup, MeetupPerson } from "@/types";

// イベント: a trip one traveller hosts and others join — by request (the
// host approves), by invitation, or straight away for open events. Who may
// change what is enforced in firestore.rules (meetups/{id}).

const MESSAGE_WINDOW = 80;

export type MeetupDraft = Omit<Meetup, "id" | "hostUid" | "members" | "pending" | "invites" | "people">;

function fromDoc(id: string, data: Omit<Meetup, "id">): Meetup {
  return {
    ...data,
    id,
    members: data.members ?? [],
    pending: data.pending ?? [],
    invites: data.invites ?? [],
    people: data.people ?? {},
  };
}

async function listWhere(field: string, op: "==" | "array-contains", value: string): Promise<Meetup[]> {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "meetups"), where(field, op, value), limit(100)));
  return snapshot.docs.map((entry) => fromDoc(entry.id, entry.data() as Omit<Meetup, "id">));
}

// Today in Japan as "YYYY-MM-DD" (events are dated in local time).
export function todayJst(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}

export async function createMeetup(
  host: { uid: string; person: MeetupPerson },
  draft: MeetupDraft,
  invitees: { uid: string; person: MeetupPerson }[],
): Promise<string | null> {
  if (!db) return null;
  const people: Record<string, MeetupPerson> = { [host.uid]: host.person };
  for (const invitee of invitees) people[invitee.uid] = invitee.person;
  const ref = await addDoc(collection(db, "meetups"), {
    ...draft,
    official: draft.official ?? false,
    hostUid: host.uid,
    members: [host.uid],
    pending: [],
    invites: invitees.map((invitee) => invitee.uid).filter((uid) => uid !== host.uid),
    people,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Fields left empty in the edit form are removed, not kept.
export async function updateMeetup(id: string, patch: Partial<MeetupDraft>) {
  if (!db) return;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) data[key] = value === undefined ? deleteField() : value;
  await updateDoc(doc(db, "meetups", id), data);
}

export async function deleteMeetup(id: string) {
  if (!db) return;
  await deleteDoc(doc(db, "meetups", id));
}

export async function getMeetup(id: string): Promise<Meetup | null> {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "meetups", id));
  return snapshot.exists() ? fromDoc(snapshot.id, snapshot.data() as Omit<Meetup, "id">) : null;
}

// Live view of one meetup (requests and members change while you look).
export function subscribeMeetup(
  id: string,
  onChange: (meetup: Meetup | null) => void,
  onError?: () => void,
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, "meetups", id),
    (snapshot) =>
      onChange(snapshot.exists() ? fromDoc(snapshot.id, snapshot.data() as Omit<Meetup, "id">) : null),
    () => onError?.(),
  );
}

export const browsePublicMeetups = () => listWhere("visibility", "==", "public");
export const listJoinedMeetups = (uid: string) => listWhere("members", "array-contains", uid);
export const listInvitedMeetups = (uid: string) => listWhere("invites", "array-contains", uid);
export const listRequestedMeetups = (uid: string) => listWhere("pending", "array-contains", uid);

// ---- Joining ----

export async function requestToJoin(id: string, uid: string, person: MeetupPerson) {
  if (!db) return;
  await updateDoc(doc(db, "meetups", id), { pending: arrayUnion(uid), [`people.${uid}`]: person });
}

export async function withdrawRequest(id: string, uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "meetups", id), { pending: arrayRemove(uid) });
}

export async function joinOpenMeetup(id: string, uid: string, person: MeetupPerson) {
  if (!db) return;
  await updateDoc(doc(db, "meetups", id), { members: arrayUnion(uid), [`people.${uid}`]: person });
}

export async function acceptInvite(id: string, uid: string, person: MeetupPerson) {
  if (!db) return;
  await updateDoc(doc(db, "meetups", id), {
    members: arrayUnion(uid),
    invites: arrayRemove(uid),
    pending: arrayRemove(uid),
    [`people.${uid}`]: person,
  });
}

export async function declineInvite(id: string, uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "meetups", id), { invites: arrayRemove(uid) });
}

export async function leaveMeetup(id: string, uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "meetups", id), { members: arrayRemove(uid) });
}

// ---- Host ----

export async function approveRequest(id: string, uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "meetups", id), { pending: arrayRemove(uid), members: arrayUnion(uid) });
}

export async function rejectRequest(id: string, uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "meetups", id), { pending: arrayRemove(uid) });
}

export async function removeMember(id: string, uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "meetups", id), { members: arrayRemove(uid) });
}

// Any member may invite friends; their display info travels with the invite.
export async function inviteToMeetup(id: string, invitees: { uid: string; person: MeetupPerson }[]) {
  if (!db || !invitees.length) return;
  const patch: Record<string, unknown> = { invites: arrayUnion(...invitees.map((invitee) => invitee.uid)) };
  for (const invitee of invitees) patch[`people.${invitee.uid}`] = invitee.person;
  await updateDoc(doc(db, "meetups", id), patch);
}

// ---- Chat (members only) ----

export function subscribeMeetupMessages(
  id: string,
  onMessages: (messages: GroupMessage[]) => void,
): () => void {
  if (!db) return () => {};
  const ref = query(
    collection(db, "meetups", id, "messages"),
    orderBy("createdAt", "asc"),
    limitToLast(MESSAGE_WINDOW),
  );
  return onSnapshot(
    ref,
    (snapshot) =>
      onMessages(
        snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<GroupMessage, "id">) })),
      ),
    () => onMessages([]),
  );
}

export async function sendMeetupMessage(id: string, uid: string, name: string, text: string) {
  if (!db) return;
  await addDoc(collection(db, "meetups", id, "messages"), {
    uid,
    name,
    text,
    createdAt: serverTimestamp(),
  });
}
