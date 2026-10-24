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
import { notifyJourneysChanged } from "@/lib/journeyEvents";
import { photoDataUrl, type CompressedPhoto } from "@/lib/image/compress";
import type {
  ActiveTrip,
  JourneyResult,
  PlaceReview,
  PlaceStatus,
  TabibitoProfile,
  TripReview,
} from "@/types";

// ---- Active trip (one per account): users/{uid}/meta/activeTrip ----

export async function fetchActiveTrip(uid: string): Promise<ActiveTrip | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid, "meta", "activeTrip"));
  const trip = snap.exists() ? (snap.data().trip as ActiveTrip | undefined) : undefined;
  return trip?.journey?.destination ? trip : null;
}

export async function saveActiveTrip(uid: string, trip: ActiveTrip | null) {
  if (!db) return;
  const ref = doc(db, "users", uid, "meta", "activeTrip");
  if (trip) await setDoc(ref, { trip, updatedAt: serverTimestamp() });
  else await deleteDoc(ref);
}

// Save the journey to the account if it isn't yet, without wiping fields
// (status, date, review) of one that already is.
export async function upsertJourneyStatus(
  uid: string,
  journey: JourneyResult,
  status: PlaceStatus,
  extra: Record<string, unknown> = {},
) {
  if (!db) return;
  const ref = doc(db, "users", uid, "journeys", journey.id);
  const snap = await getDoc(ref);
  const fields = { status, visited: status === "done", ...extra };
  if (snap.exists()) await updateDoc(ref, fields);
  else await setDoc(ref, { ...journey, ...fields, savedAt: serverTimestamp() });
  notifyJourneysChanged();
}

// ---- Photos: one compressed JPEG per document in /photos ----

function photoId(uid: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${uid.slice(0, 8)}-${Date.now().toString(36)}-${random}`;
}

export async function uploadTripPhoto(
  uid: string,
  placeId: string,
  photo: CompressedPhoto,
  isPublic: boolean,
): Promise<string> {
  if (!db) throw new Error("no db");
  const id = photoId(uid);
  await setDoc(doc(db, "photos", id), {
    owner: uid,
    placeId,
    data: photo.data,
    mime: photo.mime,
    w: photo.w,
    h: photo.h,
    public: isPublic,
    createdAt: serverTimestamp(),
  });
  return id;
}

const photoCache = new Map<string, Promise<string | null>>();

// Data URL for a stored photo (cached per session).
export function getPhotoUrl(id: string): Promise<string | null> {
  const cached = photoCache.get(id);
  if (cached) return cached;
  const load = (async () => {
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, "photos", id));
      if (!snap.exists()) return null;
      const data = snap.data();
      return typeof data.data === "string"
        ? photoDataUrl({ data: data.data, mime: data.mime ?? "image/jpeg" })
        : null;
    } catch {
      return null;
    }
  })();
  photoCache.set(id, load);
  return load;
}

// ---- Trip record: the traveller's review after arriving ----

export async function submitTripRecord({
  uid,
  journey,
  review,
  profile,
  fallbackName,
}: {
  uid: string;
  journey: JourneyResult;
  review: TripReview;
  profile: TabibitoProfile | null;
  fallbackName: string;
}) {
  if (!db) return;
  await upsertJourneyStatus(uid, journey, "done", { review });
  if (!review.public) return;
  const entry: Record<string, unknown> = {
    uid,
    // firestore.rules caps the name at 60 characters.
    name: (profile?.displayName || fallbackName).slice(0, 60),
    rating: review.rating,
    text: review.text,
    photoIds: review.photoIds,
    placeName: journey.destination.name,
    prefecture: journey.prefecture.nameJa,
    verified: review.verified,
    visitedAt: review.visitedAt,
    createdAt: serverTimestamp(),
  };
  if (profile?.avatarEmoji) entry.avatarEmoji = profile.avatarEmoji;
  if (profile?.avatarColor) entry.avatarColor = profile.avatarColor;
  await setDoc(doc(db, "placeReviews", journey.destination.id, "reviews", uid), entry);
}

export async function fetchPlaceReviews(placeId: string, count = 6): Promise<PlaceReview[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(
      collection(db, "placeReviews", placeId, "reviews"),
      orderBy("createdAt", "desc"),
      limit(count),
    ),
  );
  return snap.docs.map((entry) => entry.data() as PlaceReview);
}
