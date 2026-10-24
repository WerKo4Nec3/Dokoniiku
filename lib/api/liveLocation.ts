import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LiveLocation, TabibitoProfile } from "@/types";

// liveLocations/{uid}: the sharer's latest position, readable only by the
// friends listed in `viewers`, and only until `expiresAt`.

export async function writeLiveLocation(
  uid: string,
  data: {
    profile: TabibitoProfile | null;
    fallbackName: string;
    viewers: string[];
    expiresAt: number;
    lat: number;
    lon: number;
    accuracy: number;
    heading?: string;
  },
) {
  if (!db) return;
  const entry: Record<string, unknown> = {
    uid,
    name: (data.profile?.displayName || data.fallbackName).slice(0, 60),
    viewers: data.viewers,
    lat: Math.round(data.lat * 1e5) / 1e5,
    lon: Math.round(data.lon * 1e5) / 1e5,
    accuracy: Math.round(data.accuracy),
    expiresAt: Timestamp.fromMillis(data.expiresAt),
    updatedAt: serverTimestamp(),
  };
  if (data.profile?.avatarEmoji) entry.avatarEmoji = data.profile.avatarEmoji;
  if (data.profile?.avatarColor) entry.avatarColor = data.profile.avatarColor;
  if (data.heading) entry.heading = data.heading;
  await setDoc(doc(db, "liveLocations", uid), entry);
}

export async function clearLiveLocation(uid: string) {
  if (!db) return;
  await deleteDoc(doc(db, "liveLocations", uid));
}

const millis = (value: unknown): number =>
  value instanceof Timestamp ? value.toMillis() : typeof value === "number" ? value : 0;

// Friends currently sharing with me (expired entries are dropped here; the
// owner's app deletes them when it notices).
export function subscribeSharedWithMe(
  uid: string,
  onChange: (items: LiveLocation[]) => void,
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, "liveLocations"), where("viewers", "array-contains", uid)),
    (snap) => {
      const now = Date.now();
      onChange(
        snap.docs
          .map((entry) => {
            const data = entry.data();
            return {
              ...(data as Omit<LiveLocation, "updatedAt" | "expiresAt">),
              updatedAt: millis(data.updatedAt) || now,
              expiresAt: millis(data.expiresAt),
            } as LiveLocation;
          })
          .filter((item) => item.expiresAt > now),
      );
    },
    () => onChange([]),
  );
}

// My own shared position (to show "you" on the map while sharing).
export function subscribeMine(
  uid: string,
  onChange: (item: LiveLocation | null) => void,
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, "liveLocations", uid),
    (snap) => {
      if (!snap.exists()) return onChange(null);
      const data = snap.data();
      onChange({
        ...(data as Omit<LiveLocation, "updatedAt" | "expiresAt">),
        updatedAt: millis(data.updatedAt) || Date.now(),
        expiresAt: millis(data.expiresAt),
      } as LiveLocation);
    },
    () => onChange(null),
  );
}
