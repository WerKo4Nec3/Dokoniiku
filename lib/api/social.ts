import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  FriendRequest,
  JourneyResult,
  PublicProfile,
  SharedCard,
  TabibitoProfile,
} from "@/types";

// Deterministic id for the friendship between two users.
export function friendshipIdFor(a: string, b: string): string {
  return [a, b].sort().join("_");
}

function makeFriendCode(): string {
  // 6 chars, unambiguous alphabet (no 0/O/1/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

// ---- Public profile ----

// Make sure the signed-in user has a public profile with a friend code,
// then keep its display fields in sync with the private tabibito profile.
export async function ensurePublicProfile(
  uid: string,
  base: TabibitoProfile & { visitedCount?: number },
): Promise<PublicProfile | null> {
  if (!db) return null;
  const ref = doc(db, "profiles", uid);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists()
    ? (snapshot.data() as PublicProfile)
    : null;
  const next: PublicProfile = {
    uid,
    friendCode: existing?.friendCode ?? makeFriendCode(),
    displayName: base.displayName ?? existing?.displayName,
    bio: base.bio ?? existing?.bio,
    avatarEmoji: base.avatarEmoji ?? existing?.avatarEmoji,
    avatarColor: base.avatarColor ?? existing?.avatarColor,
    visitedCount: base.visitedCount ?? existing?.visitedCount ?? 0,
  };
  await setDoc(ref, { ...next, updatedAt: serverTimestamp() }, { merge: true });
  return next;
}

export async function getPublicProfile(
  uid: string,
): Promise<PublicProfile | null> {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "profiles", uid));
  return snapshot.exists() ? (snapshot.data() as PublicProfile) : null;
}

export async function findByFriendCode(
  code: string,
): Promise<PublicProfile | null> {
  if (!db) return null;
  const snapshot = await getDocs(
    query(
      collection(db, "profiles"),
      where("friendCode", "==", code.trim().toUpperCase()),
      limit(1),
    ),
  );
  const entry = snapshot.docs[0];
  return entry ? (entry.data() as PublicProfile) : null;
}

// ---- Friend requests ----

export async function sendFriendRequest(
  fromUid: string,
  toUid: string,
  fromName?: string,
) {
  if (!db) return;
  await setDoc(doc(db, "friendRequests", `${fromUid}_${toUid}`), {
    fromUid,
    toUid,
    fromName: fromName ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function listIncomingRequests(
  uid: string,
): Promise<FriendRequest[]> {
  if (!db) return [];
  const snapshot = await getDocs(
    query(collection(db, "friendRequests"), where("toUid", "==", uid)),
  );
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<FriendRequest, "id">),
  }));
}

export async function acceptFriendRequest(myUid: string, fromUid: string) {
  if (!db) return;
  // Order matters: the friendship rule checks that the request still exists.
  await setDoc(doc(db, "friendships", friendshipIdFor(myUid, fromUid)), {
    members: [myUid, fromUid].sort(),
    requestFrom: fromUid,
    createdAt: serverTimestamp(),
  });
  await deleteDoc(doc(db, "friendRequests", `${fromUid}_${myUid}`));
}

export async function declineFriendRequest(myUid: string, fromUid: string) {
  if (!db) return;
  await deleteDoc(doc(db, "friendRequests", `${fromUid}_${myUid}`));
}

// ---- Friends ----

export async function listFriendProfiles(
  uid: string,
): Promise<PublicProfile[]> {
  if (!db) return [];
  const snapshot = await getDocs(
    query(
      collection(db, "friendships"),
      where("members", "array-contains", uid),
    ),
  );
  const otherIds = snapshot.docs
    .map((entry) => {
      const members = (entry.data().members ?? []) as string[];
      return members.find((member) => member !== uid);
    })
    .filter((value): value is string => Boolean(value));
  const profiles = await Promise.all(
    otherIds.map((otherUid) => getPublicProfile(otherUid).catch(() => null)),
  );
  return profiles.filter((value): value is PublicProfile => Boolean(value));
}

export async function removeFriend(myUid: string, otherUid: string) {
  if (!db) return;
  await deleteDoc(doc(db, "friendships", friendshipIdFor(myUid, otherUid)));
}

// ---- Shared cards ----

export async function shareCardWithFriend(
  fromUid: string,
  toUid: string,
  journey: JourneyResult,
  fromName?: string,
) {
  if (!db) return;
  // One doc per (journey, recipient) so resharing doesn't spam the inbox.
  await setDoc(doc(db, "sharedCards", `${journey.id}_${toUid}`), {
    fromUid,
    toUid,
    fromName: fromName ?? null,
    friendshipId: friendshipIdFor(fromUid, toUid),
    journey,
    createdAt: serverTimestamp(),
  });
}

export async function listSharedInbox(uid: string): Promise<SharedCard[]> {
  if (!db) return [];
  const snapshot = await getDocs(
    query(collection(db, "sharedCards"), where("toUid", "==", uid)),
  );
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<SharedCard, "id">),
  }));
}

export async function deleteSharedCard(id: string) {
  if (!db) return;
  await deleteDoc(doc(db, "sharedCards", id));
}
