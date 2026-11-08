import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { adminApp } from "@/lib/server/firebaseAdmin";

// POST /api/notify { kind, meetupId?, uids?, cardId? } with the caller's
// Firebase ID token → push notifications to the people it concerns.
// The caller only says WHAT happened; who receives it, and the text, come
// from Firestore here, after checking the caller really did it (is in the
// event, sent the request, shared the card…). Repeats are spaced out per
// recipient (pushLog/*, unreadable to clients).

export const dynamic = "force-dynamic";

type Kind = "invite" | "request" | "approved" | "message" | "friend" | "share" | "test";
type Body = { kind?: Kind; meetupId?: unknown; uids?: unknown; cardId?: unknown };
type Plan = {
  to: string[];
  title: string;
  body: string;
  url: string;
  tag: string;
  // pushLog key for one recipient, and the minimum gap between two pushes.
  key: (uid: string) => string;
  gapMs: number;
  // Show it even while the app is open (the confirmation after turning on).
  always?: boolean;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const clip = (text: string, length = 80) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);
const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length < 300 && !value.includes("/");
const idList = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isId).slice(0, 50) : []);

async function plan(db: Firestore, from: string, request: Body): Promise<Plan | null> {
  const { kind } = request;

  // Right after a device turns notifications on: proof that it works.
  if (kind === "test") {
    return {
      to: [from],
      title: "通知がオンになりました",
      body: "招待やメッセージが届くと、ここでお知らせします",
      url: "/meetups",
      tag: "push-test",
      key: () => `test:${from}`,
      gapMs: 30_000,
      always: true,
    };
  }

  if (kind === "friend") {
    const to = idList(request.uids)[0];
    if (!to) return null;
    const sent = await db.doc(`friendRequests/${from}_${to}`).get();
    if (!sent.exists) return null;
    return {
      to: [to],
      title: `${sent.get("fromName") || "旅人"}さんからなかま申請`,
      body: "なかまのページで承認できます",
      url: "/friends",
      tag: `friend-${from}`,
      key: () => `friend:${from}:${to}`,
      gapMs: 24 * HOUR,
    };
  }

  if (kind === "share") {
    if (!isId(request.cardId)) return null;
    const card = await db.doc(`sharedCards/${request.cardId}`).get();
    if (!card.exists || card.get("fromUid") !== from) return null;
    const place = card.get("journey")?.destination?.name;
    return {
      to: [card.get("toUid")].filter(isId),
      title: `${card.get("fromName") || "旅人"}さんが旅先をシェアしました`,
      body: typeof place === "string" ? clip(place, 60) : "",
      url: "/friends",
      tag: `share-${card.id}`,
      key: () => `share:${card.id}`,
      gapMs: HOUR,
    };
  }

  if (kind !== "invite" && kind !== "request" && kind !== "approved" && kind !== "message") return null;
  if (!isId(request.meetupId)) return null;
  const snapshot = await db.doc(`meetups/${request.meetupId}`).get();
  if (!snapshot.exists) return null;
  const id = snapshot.id;
  const meetup = snapshot.data() as {
    title?: string;
    hostUid?: string;
    members?: string[];
    pending?: string[];
    invites?: string[];
    people?: Record<string, { name?: string }>;
  };
  const members = meetup.members ?? [];
  const name = (uid: string) => meetup.people?.[uid]?.name || "旅人";
  const title = meetup.title || "イベント";
  const url = `/meetups/${id}`;

  if (kind === "invite") {
    if (!members.includes(from)) return null;
    const invites = meetup.invites ?? [];
    return {
      to: idList(request.uids).filter((uid) => invites.includes(uid) && uid !== from),
      title: `「${title}」に招待されました`,
      body: `${name(from)}さんから`,
      url,
      tag: `invite-${id}`,
      key: (uid) => `invite:${id}:${uid}`,
      gapMs: 12 * HOUR,
    };
  }

  if (kind === "request") {
    if (!(meetup.pending ?? []).includes(from) || !isId(meetup.hostUid)) return null;
    return {
      to: [meetup.hostUid],
      title: `${name(from)}さんが参加したいそうです`,
      body: `「${title}」`,
      url,
      tag: `request-${id}`,
      key: () => `request:${id}:${from}`,
      gapMs: 12 * HOUR,
    };
  }

  if (kind === "approved") {
    if (meetup.hostUid !== from) return null;
    return {
      to: idList(request.uids).filter((uid) => members.includes(uid) && uid !== from),
      title: `「${title}」への参加が決まりました`,
      body: "主催者が承認しました",
      url,
      tag: `approved-${id}`,
      key: (uid) => `approved:${id}:${uid}`,
      gapMs: 12 * HOUR,
    };
  }

  // A chat message: the text is the sender's latest message, read here.
  if (!members.includes(from)) return null;
  const recent = await db.collection(`meetups/${id}/messages`).orderBy("createdAt", "desc").limit(5).get();
  const latest = recent.docs.map((entry) => entry.data()).find((entry) => entry.uid === from);
  if (!latest) return null;
  return {
    to: members.filter((uid) => uid !== from),
    title: `「${title}」に新しいメッセージ`,
    body: clip(`${latest.name || name(from)}：${typeof latest.text === "string" ? latest.text : ""}`),
    url,
    tag: `chat-${id}`,
    // One push per chat per few minutes; later messages wait in the お知らせ.
    key: (uid) => `message:${id}:${uid}`,
    gapMs: 3 * MINUTE,
  };
}

const DEAD_TOKEN = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export async function POST(request: Request) {
  const app = adminApp();
  if (!app) return NextResponse.json({ sent: 0, reason: "not-configured" });

  const idToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let from: string;
  try {
    from = (await getAuth(app).verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getFirestore(app);
  const body = (await request.json().catch(() => ({}))) as Body;
  const push = await plan(db, from, body).catch((error) => {
    console.error("notify: plan failed", error instanceof Error ? error.message : error);
    return null;
  });
  if (!push || !push.to.length) return NextResponse.json({ sent: 0 });

  // Space out repeats: skip whoever got this same push too recently.
  const recipients = [...new Set(push.to)];
  const logRefs = recipients.map((uid) => db.doc(`pushLog/${push.key(uid).replace(/\//g, "_")}`));
  const logs = await db.getAll(...logRefs);
  const now = Date.now();
  const due = recipients.filter((_, index) => {
    const at = logs[index].get("at") as Timestamp | undefined;
    return !at || now - at.toMillis() >= push.gapMs;
  });
  if (!due.length) return NextResponse.json({ sent: 0, reason: "recent" });

  const devices = (
    await Promise.all(due.map((uid) => db.collection(`users/${uid}/pushTokens`).limit(10).get()))
  ).flatMap((result) =>
    result.docs
      .map((entry) => ({ ref: entry.ref, token: entry.get("token") as unknown }))
      .filter((device): device is { ref: typeof device.ref; token: string } => typeof device.token === "string"),
  );
  if (!devices.length) return NextResponse.json({ sent: 0, reason: "no-devices" });

  const result = await getMessaging(app).sendEachForMulticast({
    tokens: devices.map((device) => device.token),
    // Data only: the service worker (public/sw.js) shows it, so it can stay
    // quiet while the app is open in front of you.
    data: { title: push.title, body: push.body, url: push.url, tag: push.tag, ...(push.always ? { always: "1" } : {}) },
    webpush: { headers: { Urgency: "high", TTL: String(24 * 3600) } },
  });

  const writes = db.batch();
  result.responses.forEach((response, index) => {
    if (!response.success && DEAD_TOKEN.has(response.error?.code ?? "")) writes.delete(devices[index].ref);
  });
  const stamp = Timestamp.fromMillis(now);
  for (const uid of due) {
    writes.set(logRefs[recipients.indexOf(uid)], { at: stamp });
  }
  await writes.commit().catch(() => undefined);

  return NextResponse.json({ sent: result.successCount });
}
