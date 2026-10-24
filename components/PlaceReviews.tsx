"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MapPinCheck, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchPlaceReviews, getPhotoUrl } from "@/lib/api/trips";
import type { PlaceReview } from "@/types";

function ReviewPhoto({ id, onOpen }: { id: string; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getPhotoUrl(id).then((value) => {
      if (active) setUrl(value);
    });
    return () => {
      active = false;
    };
  }, [id]);
  if (!url) return <span className="block aspect-square animate-pulse rounded-xl bg-[color:var(--surface-muted)]" />;
  return (
    <button type="button" onClick={() => onOpen(url)} className="block aspect-square overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover transition hover:scale-105" />
    </button>
  );
}

// "みんなの旅の記録": recent public records other travellers left here.
export function PlaceReviews({ placeId, className = "" }: { placeId: string; className?: string }) {
  const [reviews, setReviews] = useState<PlaceReview[] | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPlaceReviews(placeId)
      .then((items) => {
        if (active) setReviews(items);
      })
      .catch(() => {
        if (active) setReviews([]);
      });
    return () => {
      active = false;
    };
  }, [placeId]);

  if (!reviews?.length) return null;
  const average = reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length;

  return (
    <section className={`rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black">みんなの旅の記録</h3>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--muted)]">
          <Star size={13} className="fill-sun text-sun" />
          {average.toFixed(1)}（{reviews.length}件）
        </span>
      </div>
      <ul className="mt-4 space-y-4">
        {reviews.map((review) => (
          <li key={review.uid} className="border-t border-[color:var(--line)] pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base"
                style={{ backgroundColor: review.avatarColor ?? "var(--surface-muted)" }}
              >
                {review.avatarEmoji ?? "🧳"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{review.name}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--muted)]">
                  <span className="inline-flex">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        size={11}
                        className={value <= review.rating ? "fill-sun text-sun" : "text-[color:var(--line)]"}
                      />
                    ))}
                  </span>
                  {new Date(review.visitedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                </span>
              </span>
              {review.verified && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-vermilion/10 px-2 py-1 text-[10px] font-black text-vermilion">
                  <MapPinCheck size={12} /> 現地認証
                </span>
              )}
            </div>
            {review.text && <p className="mt-2 text-sm leading-6">{review.text}</p>}
            {review.photoIds.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {review.photoIds.map((id) => (
                  <ReviewPhoto key={id} id={id} onOpen={setLightbox} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {lightbox && (
          <motion.button
            type="button"
            aria-label="閉じる"
            onClick={() => setLightbox(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2100] grid place-items-center bg-black/85 p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
            <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white">
              <X size={20} />
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  );
}
