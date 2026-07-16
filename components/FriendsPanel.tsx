"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  Copy,
  QrCode,
  RefreshCw,
  ScanLine,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type {
  FriendRequest,
  JourneyResult,
  PublicProfile,
  SharedCard,
  TabibitoProfile,
} from "@/types";
import {
  acceptFriendRequest,
  declineFriendRequest,
  deleteSharedCard,
  ensurePublicProfile,
  findByFriendCode,
  listFriendProfiles,
  listIncomingRequests,
  listSharedInbox,
  removeFriend,
  sendFriendRequest,
} from "@/lib/api/social";

// Pull a friend code out of a scanned QR payload — either the invite URL
// (…/friends?add=CODE) or a bare 6-char code.
function codeFromPayload(payload: string): string | null {
  const fromUrl = payload.match(/[?&]add=([A-HJ-NP-Z2-9]{6})/i);
  if (fromUrl) return fromUrl[1].toUpperCase();
  const bare = payload.trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{6}$/.test(bare) ? bare : null;
}

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

export function FriendsPanel({
  uid,
  profile,
  fallbackName,
  visitedCount,
  autoAddCode,
  onOpenJourney,
  onSaveShared,
}: {
  uid: string;
  profile: TabibitoProfile | null;
  fallbackName: string;
  visitedCount: number;
  // A friend code arriving via a scanned invite link (?add=CODE).
  autoAddCode?: string | null;
  onOpenJourney: (journey: JourneyResult) => void;
  onSaveShared: (journey: JourneyResult) => Promise<void>;
}) {
  const [me, setMe] = useState<PublicProfile | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [inbox, setInbox] = useState<SharedCard[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [scanOpen, setScanOpen] = useState(false);
  const [scanSupported, setScanSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoAddDone = useRef(false);

  const myName = profile?.displayName?.trim() || fallbackName;

  const refresh = useCallback(async () => {
    const [nextFriends, nextRequests, nextInbox] = await Promise.all([
      listFriendProfiles(uid).catch(() => []),
      listIncomingRequests(uid).catch(() => []),
      listSharedInbox(uid).catch(() => []),
    ]);
    setFriends(nextFriends);
    setRequests(nextRequests);
    setInbox(nextInbox);
  }, [uid]);

  useEffect(() => {
    setScanSupported("BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    let active = true;
    ensurePublicProfile(uid, {
      ...profile,
      displayName: myName,
      visitedCount,
    })
      .then((publicProfile) => {
        if (active && publicProfile) setMe(publicProfile);
      })
      .catch(() => {});
    refresh();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, profile, visitedCount]);

  // Render my invite QR (link form, so any camera app can open it).
  useEffect(() => {
    if (!me?.friendCode) return;
    let active = true;
    import("qrcode")
      .then((qr) =>
        qr.toDataURL(
          `${window.location.origin}/friends?add=${me.friendCode}`,
          {
            width: 480,
            margin: 1,
            color: { dark: "#1f2924", light: "#fffdf8" },
          },
        ),
      )
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [me?.friendCode]);

  const handleAddByCode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;
      setBusy(true);
      setFeedback(null);
      try {
        if (me && code === me.friendCode) {
          setFeedback("それはあなた自身のコードです。");
          return;
        }
        const target = await findByFriendCode(code);
        if (!target) {
          setFeedback("このコードの旅人は見つかりませんでした。");
          return;
        }
        if (target.uid === uid) {
          setFeedback("それはあなた自身のコードです。");
          return;
        }
        if (friends.some((friend) => friend.uid === target.uid)) {
          setFeedback(`${target.displayName ?? "その旅人"}とはもう友達です。`);
          return;
        }
        await sendFriendRequest(uid, target.uid, myName);
        setFeedback(
          `${target.displayName ?? "旅人"}にリクエストを送りました。承認を待ってね。`,
        );
        setCodeInput("");
      } catch {
        setFeedback("送信できませんでした。少し待ってからもう一度。");
      } finally {
        setBusy(false);
      }
    },
    [uid, me, friends, myName],
  );

  // A scanned invite link landed us here with ?add=CODE — send once.
  useEffect(() => {
    if (!autoAddCode || autoAddDone.current) return;
    autoAddDone.current = true;
    handleAddByCode(autoAddCode);
  }, [autoAddCode, handleAddByCode]);

  // In-app QR scanner (Chrome/Android BarcodeDetector).
  useEffect(() => {
    if (!scanOpen) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let active = true;
    const DetectorCtor = (
      window as unknown as {
        BarcodeDetector: new (options: { formats: string[] }) => BarcodeDetectorLike;
      }
    ).BarcodeDetector;
    const detector = new DetectorCtor({ formats: ["qr_code"] });

    async function tick() {
      if (!active) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          const code = codes.length
            ? codeFromPayload(codes[0].rawValue)
            : null;
          if (code) {
            setScanOpen(false);
            handleAddByCode(code);
            return;
          }
        } catch {
          // detection hiccup — keep scanning
        }
      }
      frame = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((nextStream) => {
        if (!active) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = nextStream;
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
          videoRef.current.play().catch(() => {});
        }
        tick();
      })
      .catch(() => {
        setFeedback("カメラを起動できませんでした。コード入力を使ってね。");
        setScanOpen(false);
      });

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanOpen, handleAddByCode]);

  async function handleAccept(request: FriendRequest) {
    setBusy(true);
    try {
      await acceptFriendRequest(uid, request.fromUid);
      await refresh();
    } catch {
      setFeedback("承認できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline(request: FriendRequest) {
    setBusy(true);
    try {
      await declineFriendRequest(uid, request.fromUid);
      setRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUnfriend(friend: PublicProfile) {
    setBusy(true);
    try {
      await removeFriend(uid, friend.uid);
      setFriends((current) =>
        current.filter((item) => item.uid !== friend.uid),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveShared(card: SharedCard) {
    await onSaveShared(card.journey);
    setSavedIds((current) => new Set(current).add(card.id));
  }

  async function handleDismissShared(card: SharedCard) {
    await deleteSharedCard(card.id).catch(() => {});
    setInbox((current) => current.filter((item) => item.id !== card.id));
  }

  async function copyCode() {
    if (!me) return;
    try {
      await navigator.clipboard.writeText(me.friendCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — the code is visible to copy by hand.
    }
  }

  return (
    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-black">
          <Users size={16} />
          旅の仲間
        </h2>
        <button
          type="button"
          onClick={() => refresh()}
          aria-label="更新"
          className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* My invite QR */}
      <div className="mt-4 flex flex-col items-center gap-3 rounded-lg bg-[color:var(--surface-muted)] p-4 sm:flex-row sm:items-center">
        {qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrUrl}
            alt={`友達コード ${me?.friendCode ?? ""} のQRコード`}
            className="h-36 w-36 shrink-0 rounded-lg bg-white p-1.5"
          />
        ) : (
          <div className="grid h-36 w-36 shrink-0 place-items-center rounded-lg bg-white/60">
            <QrCode size={40} className="text-[color:var(--muted)]" />
          </div>
        )}
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-bold text-[color:var(--muted)]">
            このQRを友達にスキャンしてもらうと、あなたに申請が届きます
          </p>
          <p className="mt-2 font-mono text-lg font-black tracking-[0.25em]">
            {me?.friendCode ?? "……"}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "コピーした！" : "コードをコピー"}
            </button>
            {scanSupported && (
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-[11px] font-black text-white transition hover:opacity-90"
              >
                <ScanLine size={12} />
                QRをスキャン
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scanner overlay */}
      {scanOpen && (
        <div className="fixed inset-0 z-[2100] flex flex-col items-center justify-center bg-black/80 p-6">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full max-w-sm rounded-xl"
          />
          <p className="mt-3 text-sm font-bold text-white">
            友達のQRコードを映してね
          </p>
          <button
            type="button"
            onClick={() => setScanOpen(false)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-5 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
          >
            <X size={15} />
            閉じる
          </button>
        </div>
      )}

      {/* Manual code entry (fallback when scanning isn't handy) */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={codeInput}
          onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
          placeholder="コードを直接入力（例: A2C4EF）"
          maxLength={6}
          className="min-w-0 flex-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] px-3 py-2 font-mono text-sm font-bold uppercase tracking-widest outline-none focus:border-vermilion"
        />
        <button
          type="button"
          onClick={() => handleAddByCode(codeInput)}
          disabled={busy || codeInput.trim().length < 6}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-forest px-3.5 py-2 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <UserPlus size={14} />
          申請
        </button>
      </div>
      {feedback && (
        <p className="mt-2 text-xs font-bold text-[color:var(--muted)]">
          {feedback}
        </p>
      )}

      {/* Incoming requests */}
      {requests.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-vermilion">
            届いたリクエスト（{requests.length}）
          </p>
          <ul className="mt-2 space-y-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-vermilion/30 bg-vermilion/5 px-3 py-2"
              >
                <span className="truncate text-sm font-bold">
                  {request.fromName ?? "名もなき旅人"}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAccept(request)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-[11px] font-black text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Check size={12} />
                    承認
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(request)}
                    disabled={busy}
                    aria-label="辞退"
                    className="grid h-7 w-7 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
                  >
                    <X size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Friends list */}
      <div className="mt-5">
        <p className="text-xs font-bold text-[color:var(--muted)]">
          友達（{friends.length}）
        </p>
        {friends.length === 0 ? (
          <p className="mt-2 text-xs font-medium text-[color:var(--muted)]">
            QRを見せ合って、旅の仲間を増やそう。
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {friends.map((friend) => (
              <li
                key={friend.uid}
                className="flex items-center gap-3 rounded-lg border border-[color:var(--line)] px-3 py-2"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                  style={{
                    backgroundColor: `${friend.avatarColor ?? "#285f4d"}22`,
                  }}
                >
                  {friend.avatarEmoji ?? "🐣"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {friend.displayName ?? "名もなき旅人"}
                  </span>
                  <span className="block text-[11px] font-medium text-[color:var(--muted)]">
                    制覇 {friend.visitedCount ?? 0}件
                    {friend.bio ? ` ・ ${friend.bio}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleUnfriend(friend)}
                  disabled={busy}
                  aria-label="友達から外す"
                  title="友達から外す"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-vermilion/10 hover:text-vermilion"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Shared-with-me inbox */}
      {inbox.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-[color:var(--muted)]">
            共有された旅（{inbox.length}）
          </p>
          <ul className="mt-2 space-y-2">
            {inbox.map((card) => (
              <li
                key={card.id}
                className="flex items-center gap-3 rounded-lg border border-[color:var(--line)] px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => onOpenJourney(card.journey)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-bold underline-offset-2 hover:underline">
                    {card.journey.destination.name}
                  </span>
                  <span className="block text-[11px] font-medium text-[color:var(--muted)]">
                    {card.journey.prefecture.nameJa} ・{" "}
                    {card.fromName ?? "旅人"}から
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveShared(card)}
                  disabled={savedIds.has(card.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--line)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] disabled:opacity-50"
                >
                  <Bookmark size={12} />
                  {savedIds.has(card.id) ? "保存済み" : "保存"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissShared(card)}
                  aria-label="削除"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-vermilion/10 hover:text-vermilion"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
