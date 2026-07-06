import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { JourneyResult, SavedJourney } from "@/types";

const RECENT_MAX = 5;

function journeysCollection(uid: string) {
  if (!db) return null;
  return collection(db, "users", uid, "journeys");
}

// Every generated journey is saved under the signed-in user's account.
export async function saveJourneyForUser(uid: string, journey: JourneyResult) {
  if (!db) return;
  await setDoc(doc(db, "users", uid, "journeys", journey.id), {
    ...journey,
    savedAt: serverTimestamp(),
  });
}

export async function fetchUserJourneys(uid: string): Promise<SavedJourney[]> {
  const ref = journeysCollection(uid);
  if (!ref) return [];
  const snapshot = await getDocs(query(ref, orderBy("savedAt", "desc"), limit(100)));
  return snapshot.docs.map((entry) => entry.data() as SavedJourney);
}

export async function deleteUserJourney(uid: string, id: string) {
  if (!db) return;
  await deleteDoc(doc(db, "users", uid, "journeys", id));
}

export async function setJourneyVisited(
  uid: string,
  id: string,
  visited: boolean,
) {
  if (!db) return;
  await updateDoc(doc(db, "users", uid, "journeys", id), { visited });
}

// The recent-history list is kept as one document per user so it syncs
// across devices when signed in.
export async function fetchRecentForUser(
  uid: string,
): Promise<JourneyResult[]> {
  if (!db) return [];
  const snapshot = await getDoc(doc(db, "users", uid, "meta", "recent"));
  const data = snapshot.exists() ? snapshot.data() : null;
  return data && Array.isArray(data.items)
    ? (data.items as JourneyResult[])
    : [];
}

export async function saveRecentForUser(
  uid: string,
  items: JourneyResult[],
) {
  if (!db) return;
  await setDoc(doc(db, "users", uid, "meta", "recent"), {
    items: items.slice(0, RECENT_MAX),
    updatedAt: serverTimestamp(),
  });
}
