"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Loader2, MapPinCheck, Share2, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { openAuthDialog } from "@/components/AuthDialog";
import { ShareToFriendButton } from "@/components/ShareToFriendButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchProfile } from "@/lib/api/profile";
import { submitTripRecord, uploadTripPhoto } from "@/lib/api/trips";
import { compressPhoto, photoDataUrl, type CompressedPhoto } from "@/lib/image/compress";
import { buildShareCard } from "@/lib/share/shareCard";
import { endTrip } from "@/lib/trips";
import type { ActiveTrip, TabibitoProfile } from "@/types";

const MAX_PHOTOS = 4;
const MAX_TEXT = 280;

// The travel record: stars, a line or two, up to four photos. Saved to the
// journey (always) and shown on the place page (when public). Used inside
// the dialog and inline on the 旅の途中 page.
export function TripRecordForm({
  trip,
  onFinish,
  finishLabel = "とじる",
}: {
  trip: ActiveTrip;
  /** Called from the success screen. */
  onFinish: () => void;
  finishLabel?: string;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<CompressedPhoto[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [profile, setProfile] = useState<TabibitoProfile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchProfile(user.uid)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    try {
      const compressed = await Promise.all(picked.map((file) => compressPhoto(file)));
      setPhotos((current) => [...current, ...compressed].slice(0, MAX_PHOTOS));
    } catch {
      setError("写真を読み込めませんでした。別の写真を試してね。");
    }
  }

  async function submit() {
    if (!user || busy) return;
    if (!rating) {
      setError("星をえらんでね。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const photoIds = await Promise.all(
        photos.map((photo) =>
          uploadTripPhoto(user.uid, trip.journey.destination.id, photo, isPublic),
        ),
      );
      await submitTripRecord({
        uid: user.uid,
        journey: trip.journey,
        review: {
          rating,
          text: text.trim().slice(0, MAX_TEXT),
          photoIds,
          verified: Boolean(trip.verified),
          visitedAt: trip.arrivedAt ?? new Date().toISOString(),
          public: isPublic,
        },
        profile,
        fallbackName: user.displayName || "旅人",
      });
      setDone(true);
    } catch {
      setError("保存できませんでした。通信を確認して、もう一度試してね。");
    } finally {
      setBusy(false);
    }
  }

  async function shareImage() {
    const cover = photos[0] ? photoDataUrl(photos[0]) : trip.journey.destination.imageUrl;
    const journey = { ...trip.journey, destination: { ...trip.journey.destination, imageUrl: cover } };
    const blob = await buildShareCard(journey).catch(() => null);
    if (!blob) return;
    const file = new File([blob], "dokoniiku-record.png", { type: "image/png" });
    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${trip.journey.destination.name}に行ってきた！` });
        return;
      }
    } catch {
      return; // share sheet cancelled
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  if (done) {
    return (
      <div className="p-6 text-center">
        <motion.div
          initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: -6, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14 }}
          className="mx-auto grid h-24 w-24 place-items-center rounded-full border-4 border-vermilion text-center font-display text-lg font-black leading-tight text-vermilion"
        >
          旅の
          <br />
          記録
        </motion.div>
        <p className="mt-4 text-base font-bold">記録を残しました！</p>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          {isPublic ? "場所のページで、ほかの旅人にも届きます。" : "自分だけの記録として保存しました。"}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void shareImage()}
            className="inline-flex items-center gap-2 rounded-full bg-vermilion px-5 py-3 text-sm font-bold text-white"
          >
            <Share2 size={16} /> 画像でシェア
          </button>
          {user && (
            <ShareToFriendButton
              uid={user.uid}
              myName={profile?.displayName || user.displayName || "旅人"}
              journey={trip.journey}
            />
          )}
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="mt-5 text-sm font-bold text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
        >
          {finishLabel}
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm font-bold">記録を残すにはログインしてね</p>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          写真とひとことは、あなたのアカウントに保存されます。
        </p>
        <button
          type="button"
          onClick={openAuthDialog}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-vermilion px-6 py-3 text-sm font-bold text-white"
        >
          ログイン / 登録
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div>
        <p className="text-xs font-bold text-[color:var(--muted)]">どうだった？</p>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="評価">
          {[1, 2, 3, 4, 5].map((value) => (
            <motion.button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value}つ星`}
              whileTap={{ scale: 0.8 }}
              onClick={() => setRating(value)}
              className="p-1"
            >
              <Star
                size={30}
                className={value <= rating ? "fill-sun text-sun" : "text-[color:var(--line)]"}
              />
            </motion.button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-bold text-[color:var(--muted)]">ひとこと（任意）</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT))}
          rows={3}
          placeholder="朝いちばんが空いていて最高だった！"
          className="mt-2 w-full resize-none rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm outline-none transition focus:border-vermilion"
        />
        <span className="mt-1 block text-right text-[10px] text-[color:var(--muted)]">
          {text.length}/{MAX_TEXT}
        </span>
      </label>

      <div>
        <p className="text-xs font-bold text-[color:var(--muted)]">
          写真（{photos.length}/{MAX_PHOTOS}）
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {photos.map((photo, index) => (
            <div key={index} className="relative aspect-square overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoDataUrl(photo)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="写真を外す"
                onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-[color:var(--line)] text-[color:var(--muted)] transition hover:border-vermilion hover:text-vermilion"
            >
              <Camera size={22} />
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void addPhotos(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <label className="flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--surface-muted)] px-4 py-3">
        <span>
          <span className="block text-sm font-bold">みんなに公開</span>
          <span className="block text-[11px] text-[color:var(--muted)]">
            この場所のページで、ほかの旅人が見られます
          </span>
        </span>
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
          className="h-5 w-5 accent-[rgb(var(--c-vermilion))]"
        />
      </label>

      {error && <p className="text-xs font-bold text-[color:var(--brand-ink)]">{error}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="scene-cta w-full justify-center"
      >
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
        {busy ? "保存中…" : "記録を残す"}
      </button>
    </div>
  );
}

export function TripRecordDialog({
  trip,
  open,
  onClose,
  endsTrip = true,
}: {
  trip: ActiveTrip;
  open: boolean;
  onClose: () => void;
  /** Close the open trip when done (false for a standalone check-in). */
  endsTrip?: boolean;
}) {
  function finish() {
    if (endsTrip) endTrip();
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[2000] overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="fixed inset-0 cursor-default bg-black/55 backdrop-blur-sm"
          />
          <div className="relative flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-2xl"
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="閉じる"
                className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/30 text-white transition hover:bg-black/45"
              >
                <X size={18} />
              </button>

              <div className="relative h-36 overflow-hidden bg-forest/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={trip.journey.destination.imageUrl ?? "/travel-backdrop.jpg"}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-5 right-14 text-white">
                  <p className="text-[11px] font-bold tracking-[0.25em] text-white/80">旅の記録</p>
                  <p className="truncate font-display text-2xl font-bold">{trip.journey.destination.name}</p>
                </div>
                {trip.verified && (
                  <span className="absolute right-4 top-14 inline-flex rotate-[-8deg] items-center gap-1 rounded-md border-2 border-white/90 bg-vermilion/90 px-2 py-1 text-[11px] font-black text-white shadow">
                    <MapPinCheck size={13} /> 現地認証
                  </span>
                )}
              </div>

              <TripRecordForm trip={trip} onFinish={finish} />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
