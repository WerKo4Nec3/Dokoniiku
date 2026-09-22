"use client";

import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { openAuthDialog } from "@/components/AuthDialog";
import {
  getPlaceRating,
  isExcluded,
  votePlace,
  type PlaceRating as Rating,
  type Vote,
} from "@/lib/api/ratings";

// 👍/👎 for a place. Your 👎 removes it from your future picks; enough 👎 from
// everyone removes it from the randomizer for all travellers.
export function PlaceRating({
  placeId,
  name,
  prefecture,
  className = "",
}: {
  placeId: string;
  name: string;
  prefecture: string;
  className?: string;
}) {
  const { enabled, user } = useAuth();
  const [rating, setRating] = useState<Rating | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getPlaceRating(placeId, user?.uid)
      .then((r) => active && setRating(r))
      .catch(() => active && setRating({ up: 0, down: 0, myVote: 0 }));
    return () => {
      active = false;
    };
  }, [placeId, user?.uid]);

  if (!enabled) return null;

  async function vote(value: Vote) {
    if (!user) {
      openAuthDialog();
      return;
    }
    if (busy || rating?.myVote === value) return;
    setBusy(true);
    setError(false);
    try {
      setRating(await votePlace(placeId, user.uid, value, { name, prefecture }));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const up = rating?.up ?? 0;
  const down = rating?.down ?? 0;
  const mine = rating?.myVote ?? 0;
  const btn = (active: boolean, tone: "up" | "down") =>
    `inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-black transition disabled:opacity-60 ${
      active
        ? tone === "up"
          ? "border-forest bg-forest/10 text-forest dark:border-forest-ink dark:text-forest-ink"
          : "border-vermilion bg-vermilion/10 text-vermilion"
        : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
    }`;

  return (
    <div
      className={`rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5 ${className}`}
    >
      <p className="text-xs font-bold text-[color:var(--muted)]">この場所、どうだった？</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => vote(1)}
          disabled={busy}
          aria-pressed={mine === 1}
          className={btn(mine === 1, "up")}
        >
          <ThumbsUp size={16} /> よかった
          <span className="tabular-nums opacity-80">{up}</span>
        </button>
        <button
          type="button"
          onClick={() => vote(-1)}
          disabled={busy}
          aria-pressed={mine === -1}
          className={btn(mine === -1, "down")}
        >
          <ThumbsDown size={16} /> いまいち
          <span className="tabular-nums opacity-80">{down}</span>
        </button>
      </div>
      {mine === -1 && (
        <p className="mt-2.5 text-[11px] font-medium text-[color:var(--muted)]">
          了解！次からこの場所はあなたの抽選に出てきません。
        </p>
      )}
      {mine !== -1 && isExcluded(up, down) && (
        <p className="mt-2.5 text-[11px] font-medium text-[color:var(--brand-ink)]">
          みんなの評価が低いため、通常は抽選から外れている場所です。
        </p>
      )}
      {error && (
        <p className="mt-2.5 text-[11px] font-medium text-[color:var(--brand-ink)]">
          評価を保存できませんでした。少し時間をおいて試してね。
        </p>
      )}
    </div>
  );
}
