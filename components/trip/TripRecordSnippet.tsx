"use client";

import { MapPinCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { getPhotoUrl } from "@/lib/api/trips";
import type { TripReview } from "@/types";

function Thumb({ id }: { id: string }) {
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
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover" />
  ) : (
    <span className="block h-12 w-12 animate-pulse rounded-lg bg-[color:var(--surface-muted)]" />
  );
}

// The traveller's own record on a saved card.
export function TripRecordSnippet({ review }: { review: TripReview }) {
  return (
    <div className="mt-3 rounded-2xl bg-[color:var(--surface-muted)] p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex">
          {[1, 2, 3, 4, 5].map((value) => (
            <Star
              key={value}
              size={12}
              className={value <= review.rating ? "fill-sun text-sun" : "text-[color:var(--line)]"}
            />
          ))}
        </span>
        <span className="text-[11px] font-bold text-[color:var(--muted)]">
          {new Date(review.visitedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}の記録
        </span>
        {review.verified && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-black text-vermilion">
            <MapPinCheck size={11} /> 現地認証
          </span>
        )}
      </div>
      {review.text && <p className="mt-1.5 line-clamp-2 text-xs leading-5">{review.text}</p>}
      {review.photoIds.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {review.photoIds.map((id) => (
            <Thumb key={id} id={id} />
          ))}
        </div>
      )}
    </div>
  );
}
