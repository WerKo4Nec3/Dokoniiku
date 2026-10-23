import {
  doc,
  increment,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";

// First-party, privacy-light analytics for the admin dashboard. Only counters
// are stored — no IPs, no per-visit logs, nothing tied to a person except a
// user's own first/last-seen day (to count users and daily actives).
//   stats_daily/{YYYY-MM-DD}  { date, visitors, sessions, searches, saves, signups }
//   stats_prefs/{prefId}      { n }  all-time searches per prefecture
//   stats_cats/{category}     { n }  all-time searches per genre
//   userIndex/{uid}           { firstSeen, lastSeen }
// firestore.rules only allow +1 steps, so counters can't be rewritten.

type DailyCounter = "visitors" | "sessions" | "searches" | "saves" | "signups";

// Days are counted in Japan time — this is a Japan travel app.
export function jstDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Returns whether the write landed, so "already counted today" markers are
// only set on success (a failed write — offline, rules not deployed yet —
// is retried on the next page load instead of being lost).
async function bumpDaily(fields: DailyCounter[]): Promise<boolean> {
  if (!db || !fields.length) return false;
  const day = jstDay();
  const data: Record<string, unknown> = { date: day };
  for (const f of fields) data[f] = increment(1);
  try {
    await setDoc(doc(db, "stats_daily", day), data, { merge: true });
    return true;
  } catch {
    return false; // analytics must never break the app
  }
}

async function bumpDoc(collection: "stats_prefs" | "stats_cats", id: string) {
  if (!db || !/^[a-z0-9-]{2,24}$/.test(id)) return;
  try {
    await setDoc(doc(db, collection, id), { n: increment(1) }, { merge: true });
  } catch {
    // ignore
  }
}

const VISIT_KEY = "tabi-compass:visit-day";
const SESSION_KEY = "tabi-compass:session";

// Once per browser per day (unique visitor) + once per tab session.
export async function trackVisit() {
  try {
    const day = jstDay();
    const newVisitor = localStorage.getItem(VISIT_KEY) !== day;
    const newSession = !sessionStorage.getItem(SESSION_KEY);
    const fields: DailyCounter[] = [];
    if (newVisitor) fields.push("visitors");
    if (newSession) fields.push("sessions");
    if (!fields.length) return;
    if (await bumpDaily(fields)) {
      if (newVisitor) localStorage.setItem(VISIT_KEY, day);
      if (newSession) sessionStorage.setItem(SESSION_KEY, "1");
    }
  } catch {
    // storage blocked (private mode) — skip
  }
}

export function trackSearch(prefectureId: string, categories: string[]) {
  void bumpDaily(["searches"]);
  void bumpDoc("stats_prefs", prefectureId);
  for (const c of new Set(categories)) void bumpDoc("stats_cats", c);
}

export function trackSave() {
  void bumpDaily(["saves"]);
}

// Keep the user index fresh (once per day per browser). New accounts — judged
// by Firebase's own creation time, so pre-existing users aren't miscounted as
// sign-ups — add one to today's signups. The create runs in a transaction so
// two tabs can't both count the same sign-up, and the "seen today" marker is
// only set once the write succeeded.
export async function touchUser(user: User) {
  if (!db) return;
  const firestore = db;
  const day = jstDay();
  const seenKey = `tabi-compass:seen:${user.uid}`;
  try {
    if (localStorage.getItem(seenKey) === day) return;
  } catch {
    // no storage — still fine, the doc read below is cheap
  }
  try {
    const ref = doc(firestore, "userIndex", user.uid);
    const created = user.metadata.creationTime
      ? jstDay(new Date(user.metadata.creationTime))
      : day;
    const isNew = await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, { firstSeen: created, lastSeen: day });
        return true;
      }
      if (snap.data().lastSeen !== day) tx.update(ref, { lastSeen: day });
      return false;
    });
    if (isNew && created === day) await bumpDaily(["signups"]);
    try {
      localStorage.setItem(seenKey, day);
    } catch {
      // ignore
    }
  } catch {
    // offline / rules not deployed — try again on the next load
  }
}
