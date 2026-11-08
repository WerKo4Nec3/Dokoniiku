import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseApp } from "@/lib/firebase";

// Push notifications (Firebase Cloud Messaging → public/sw.js).
// A device that opts in stores its FCM token in users/{uid}/pushTokens;
// /api/notify sends to those tokens. firebase/messaging is loaded only when
// it's needed, so ordinary pages don't carry it.

// Public half of the Web Push key pair (Firebase console → Cloud Messaging).
const VAPID_KEY =
  "BCkhpFBmykVrF99BmyCd_mN4EKzAxu4Vd1MBbuXYGTev6uiEehlwyFi9Wt0JGygOXpbpbESD2ka0Q0kMJj7UgEg";
const STORE = "dokoniiku:push";
const REFRESH_MS = 24 * 3600_000;

// unsupported: no push here at all · install: iPhone/iPad, works once added
// to the home screen · blocked: the browser denies it · off / on: this device.
export type PushStatus = "unsupported" | "install" | "blocked" | "off" | "on";

type Stored = { uid: string; token: string; at: number };

function readStored(): Stored | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) ?? "null") as Stored | null;
    return value?.token && value.uid ? value : null;
  } catch {
    return null;
  }
}

function writeStored(value: Stored | null) {
  try {
    if (value) localStorage.setItem(STORE, JSON.stringify(value));
    else localStorage.removeItem(STORE);
  } catch {
    // Private mode: the token still works, it just refreshes each visit.
  }
}

const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function pushStatus(uid: string): Promise<PushStatus> {
  // The worker is only registered in production builds.
  if (typeof window === "undefined" || !firebaseApp || process.env.NODE_ENV !== "production") return "unsupported";
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const { isSupported } = await import("firebase/messaging");
  if (!capable || !(await isSupported().catch(() => false))) {
    return isAppleMobile() && !isStandalone() ? "install" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" && readStored()?.uid === uid ? "on" : "off";
}

async function currentToken(): Promise<string | null> {
  if (!firebaseApp) return null;
  const { getMessaging, getToken } = await import("firebase/messaging");
  // The same worker as the offline cache; registering again returns it.
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  return getToken(getMessaging(firebaseApp), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

async function saveToken(uid: string, token: string) {
  if (!db) return;
  const previous = readStored();
  await setDoc(doc(db, "users", uid, "pushTokens", token), {
    token,
    device: navigator.userAgent.slice(0, 160),
    updatedAt: serverTimestamp(),
  });
  if (previous && previous.uid === uid && previous.token !== token) {
    await deleteDoc(doc(db, "users", uid, "pushTokens", previous.token)).catch(() => undefined);
  }
  writeStored({ uid, token, at: Date.now() });
}

// Asks the browser for permission and signs this device up. Call it straight
// from the tap: Safari only shows the prompt inside the gesture, so the
// permission is requested before anything else is awaited.
export async function enablePush(uid: string): Promise<PushStatus> {
  const permissionAsked = Notification.requestPermission();
  const status = await pushStatus(uid);
  if (status !== "off" && status !== "on") return status;
  const permission = await permissionAsked;
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const token = await currentToken();
  if (!token) return "off";
  await saveToken(uid, token);
  notify({ kind: "test" });
  return "on";
}

export async function disablePush(uid: string): Promise<void> {
  const stored = readStored();
  writeStored(null);
  if (!stored || stored.uid !== uid) return;
  if (db) await deleteDoc(doc(db, "users", uid, "pushTokens", stored.token)).catch(() => undefined);
  if (firebaseApp) {
    const { deleteToken, getMessaging } = await import("firebase/messaging");
    await deleteToken(getMessaging(firebaseApp)).catch(() => undefined);
  }
}

// On start: FCM rotates tokens now and then — keep this device's current.
export async function refreshPush(uid: string): Promise<void> {
  const stored = readStored();
  if (!stored || stored.uid !== uid || Date.now() - stored.at < REFRESH_MS) return;
  if ((await pushStatus(uid)) !== "on") return;
  const token = await currentToken().catch(() => null);
  if (token) await saveToken(uid, token);
}

export type NotifyRequest =
  | { kind: "invite" | "approved"; meetupId: string; uids: string[] }
  | { kind: "request" | "message"; meetupId: string }
  | { kind: "friend"; uids: string[] }
  | { kind: "share"; cardId: string }
  | { kind: "test" };

// Tells the server what just happened; it decides who gets a push (fire and
// forget — the in-app お知らせ works without it).
export function notify(request: NotifyRequest): void {
  const user = auth?.currentUser;
  if (!user) return;
  void user
    .getIdToken()
    .then((idToken) =>
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(request),
        keepalive: true,
      }),
    )
    .catch(() => undefined);
}
