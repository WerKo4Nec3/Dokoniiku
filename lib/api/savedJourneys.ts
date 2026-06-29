import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { JourneyResult } from "@/types";

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

export async function fetchUserJourneys(uid: string): Promise<JourneyResult[]> {
  const ref = journeysCollection(uid);
  if (!ref) return [];
  const snapshot = await getDocs(query(ref, orderBy("savedAt", "desc"), limit(100)));
  return snapshot.docs.map((entry) => entry.data() as JourneyResult);
}

export async function deleteUserJourney(uid: string, id: string) {
  if (!db) return;
  await deleteDoc(doc(db, "users", uid, "journeys", id));
}
