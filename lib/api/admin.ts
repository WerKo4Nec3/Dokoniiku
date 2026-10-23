import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { EXCLUDE_MIN_DOWN, isExcluded } from "@/lib/api/ratings";
import { jstDay } from "@/lib/analytics";

// Read side of the admin dashboard. Every read here is allowed for admins only
// by firestore.rules (admins/{uid} must exist).

export type DailyStat = {
  date: string;
  visitors: number;
  sessions: number;
  searches: number;
  saves: number;
  signups: number;
};

export type CountRow = { id: string; n: number };

export type FlaggedPlace = {
  id: string;
  name: string;
  prefecture: string;
  up: number;
  down: number;
  whitelisted: boolean;
  excluded: boolean;
};

export async function checkAdmin(uid: string): Promise<boolean> {
  if (!db) return false;
  try {
    return (await getDoc(doc(db, "admins", uid))).exists();
  } catch {
    return false;
  }
}

export function dayOffset(days: number, from = new Date()): string {
  return jstDay(new Date(from.getTime() - days * 86400000));
}

// The last `days` days (oldest → newest), zero-filled so charts stay continuous.
export async function loadDaily(days: number): Promise<DailyStat[]> {
  const today = jstDay();
  const start = dayOffset(days - 1);
  const byDay = new Map<string, DailyStat>();
  if (db) {
    const snap = await getDocs(
      // Bounded on both sides: anyone may create counter docs, so junk
      // future/ancient dates must never be read.
      query(
        collection(db, "stats_daily"),
        where("date", ">=", start),
        where("date", "<=", today),
        orderBy("date"),
      ),
    );
    snap.forEach((d) => {
      const v = d.data();
      byDay.set(d.id, {
        date: d.id,
        visitors: Number(v.visitors) || 0,
        sessions: Number(v.sessions) || 0,
        searches: Number(v.searches) || 0,
        saves: Number(v.saves) || 0,
        signups: Number(v.signups) || 0,
      });
    });
  }
  const out: DailyStat[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = dayOffset(i);
    if (date > today) continue;
    out.push(
      byDay.get(date) ?? { date, visitors: 0, sessions: 0, searches: 0, saves: 0, signups: 0 },
    );
  }
  return out;
}

export async function loadCounts(name: "stats_prefs" | "stats_cats"): Promise<CountRow[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, name));
  return snap.docs
    .map((d) => ({ id: d.id, n: Number(d.data().n) || 0 }))
    .sort((a, b) => b.n - a.n);
}

export type Totals = {
  users: number;
  activeToday: number;
  active7d: number;
  ratedPlaces: number;
  groups: number;
};

export async function loadTotals(): Promise<Totals> {
  const empty = { users: 0, activeToday: 0, active7d: 0, ratedPlaces: 0, groups: 0 };
  if (!db) return empty;
  const count = async (q: Parameters<typeof getCountFromServer>[0]) => {
    try {
      return (await getCountFromServer(q)).data().count;
    } catch {
      return 0;
    }
  };
  const users = collection(db, "userIndex");
  const [all, today, week, rated, groups] = await Promise.all([
    count(users),
    count(query(users, where("lastSeen", "==", jstDay()))),
    count(query(users, where("lastSeen", ">=", dayOffset(6)))),
    count(collection(db, "placeRatings")),
    count(collection(db, "groups")),
  ]);
  return { users: all, activeToday: today, active7d: week, ratedPlaces: rated, groups };
}

// Places with enough 👎 to matter (excluded or close to it).
export async function loadFlaggedPlaces(): Promise<FlaggedPlace[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, "placeRatings"), where("down", ">=", EXCLUDE_MIN_DOWN)),
  );
  return snap.docs
    .map((d) => {
      const v = d.data();
      const up = Number(v.up) || 0;
      const down = Number(v.down) || 0;
      const whitelisted = v.whitelisted === true;
      return {
        id: d.id,
        name: String(v.name ?? d.id),
        prefecture: String(v.prefecture ?? ""),
        up,
        down,
        whitelisted,
        excluded: isExcluded(up, down, whitelisted),
      };
    })
    .sort((a, b) => b.down - a.down);
}

export async function setWhitelisted(placeId: string, value: boolean) {
  if (!db) return;
  await updateDoc(doc(db, "placeRatings", placeId), { whitelisted: value });
}
