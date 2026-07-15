import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TabibitoProfile } from "@/types";

function profileRef(uid: string) {
  if (!db) return null;
  return doc(db, "users", uid, "meta", "profile");
}

export async function fetchProfile(
  uid: string,
): Promise<TabibitoProfile | null> {
  const ref = profileRef(uid);
  if (!ref) return null;
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? (snapshot.data() as TabibitoProfile) : null;
}

export async function saveProfile(uid: string, profile: TabibitoProfile) {
  const ref = profileRef(uid);
  if (!ref) return;
  await setDoc(
    ref,
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
