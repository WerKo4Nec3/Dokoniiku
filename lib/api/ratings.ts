import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Place ratings (👍/👎) and the exclusion list built from them.
//   placeRatings/{placeId}              { up, down, name, prefecture, updatedAt } — public
//   placeRatings/{placeId}/votes/{uid}  { value: 1 | -1, updatedAt }            — own only
//   users/{uid}/meta/hiddenPlaces        { ids: string[] }  — places YOU 👎'd
// A place drops out of everyone's randomizer once it has at least
// EXCLUDE_MIN_DOWN 👎 and 👎 outnumber 👍 by EXCLUDE_RATIO; your own 👎 hides
// it from your picks right away.

export const EXCLUDE_MIN_DOWN = 3;
export const EXCLUDE_RATIO = 2;

export type Vote = 1 | -1;
export type PlaceRating = { up: number; down: number; myVote: Vote | 0 };

export function isExcluded(up: number, down: number): boolean {
  return down >= EXCLUDE_MIN_DOWN && down >= EXCLUDE_RATIO * up;
}

export async function getPlaceRating(
  placeId: string,
  uid?: string | null,
): Promise<PlaceRating> {
  if (!db) return { up: 0, down: 0, myVote: 0 };
  const ratingSnap = await getDoc(doc(db, "placeRatings", placeId));
  const data = ratingSnap.exists() ? ratingSnap.data() : {};
  let myVote: Vote | 0 = 0;
  if (uid) {
    const voteSnap = await getDoc(doc(db, "placeRatings", placeId, "votes", uid));
    const v = voteSnap.exists() ? voteSnap.data().value : 0;
    myVote = v === 1 || v === -1 ? v : 0;
  }
  return {
    up: Number(data.up) || 0,
    down: Number(data.down) || 0,
    myVote,
  };
}

// Cast or change a vote. The counters move in lock-step with the vote doc in
// one transaction (firestore.rules enforces the same arithmetic).
export async function votePlace(
  placeId: string,
  uid: string,
  value: Vote,
  meta: { name: string; prefecture: string },
): Promise<PlaceRating> {
  if (!db) return { up: 0, down: 0, myVote: 0 };
  const firestore = db;
  const ratingRef = doc(firestore, "placeRatings", placeId);
  const voteRef = doc(firestore, "placeRatings", placeId, "votes", uid);

  const result = await runTransaction(firestore, async (tx) => {
    const ratingSnap = await tx.get(ratingRef);
    const voteSnap = await tx.get(voteRef);
    const prev: Vote | 0 = voteSnap.exists() ? (voteSnap.data().value as Vote) : 0;
    let up = ratingSnap.exists() ? Number(ratingSnap.data().up) || 0 : 0;
    let down = ratingSnap.exists() ? Number(ratingSnap.data().down) || 0 : 0;
    if (prev === value) return { up, down, myVote: value };

    if (prev === 1) up -= 1;
    if (prev === -1) down -= 1;
    if (value === 1) up += 1;
    else down += 1;

    if (ratingSnap.exists()) {
      tx.update(ratingRef, { up, down, updatedAt: serverTimestamp() });
    } else {
      tx.set(ratingRef, {
        up,
        down,
        name: meta.name.slice(0, 80),
        prefecture: meta.prefecture.slice(0, 20),
        updatedAt: serverTimestamp(),
      });
    }
    tx.set(voteRef, { value, updatedAt: serverTimestamp() });
    return { up, down, myVote: value };
  });

  // Personal hide list (private user space).
  await setDoc(
    doc(firestore, "users", uid, "meta", "hiddenPlaces"),
    { ids: value === -1 ? arrayUnion(placeId) : arrayRemove(placeId) },
    { merge: true },
  ).catch(() => {});

  excludedCache = null; // refresh the pool filter on the next pick
  return result;
}

// ---- Exclusion list for the randomizer (cached for a few minutes) ----

let excludedCache: { key: string; at: number; ids: Set<string> } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getExcludedPlaceIds(uid?: string | null): Promise<Set<string>> {
  const key = uid ?? "";
  if (excludedCache && excludedCache.key === key && Date.now() - excludedCache.at < TTL_MS) {
    return excludedCache.ids;
  }
  const ids = new Set<string>();
  if (!db) return ids;
  try {
    const snap = await getDocs(
      query(
        collection(db, "placeRatings"),
        where("down", ">=", EXCLUDE_MIN_DOWN),
        limit(500),
      ),
    );
    snap.forEach((entry) => {
      const d = entry.data();
      if (isExcluded(Number(d.up) || 0, Number(d.down) || 0)) ids.add(entry.id);
    });
  } catch {
    // rules not deployed yet / offline — just don't filter globally
  }
  if (uid) {
    try {
      const hidden = await getDoc(doc(db, "users", uid, "meta", "hiddenPlaces"));
      const list = hidden.exists() ? (hidden.data().ids as unknown) : [];
      if (Array.isArray(list)) list.forEach((id) => ids.add(String(id)));
    } catch {
      // ignore
    }
  }
  excludedCache = { key, at: Date.now(), ids };
  return ids;
}
