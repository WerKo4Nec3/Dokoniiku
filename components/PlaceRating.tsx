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
  // Your vote stays pressed in; the other one steps back a little.
  const dim = (value: Vote) => (mine !== 0 && mine !== value ? "opacity-60" : "");

  return (
    <div
      className={`card-3d rounded-[24px] bg-[color:var(--surface)] p-5 ${className}`}
    >
      <p className="text-xs font-bold text-[color:var(--muted)]">この場所、どうだった？</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => vote(1)}
          disabled={busy}
          aria-pressed={mine === 1}
          aria-label={`よかった（${up}）`}
          title="よかった"
          className={`btn-3d btn-3d-green btn-3d-lg w-full ${dim(1)}`}
        >
          <ThumbsUp size={24} strokeWidth={2.6} fill={mine === 1 ? "currentColor" : "none"} />
          <span className="tabular-nums">{up}</span>
        </button>
        <button
          type="button"
          onClick={() => vote(-1)}
          disabled={busy}
          aria-pressed={mine === -1}
          aria-label={`いまいち（${down}）`}
          title="いまいち"
          className={`btn-3d btn-3d-red btn-3d-lg w-full ${dim(-1)}`}
        >
          <ThumbsDown size={24} strokeWidth={2.6} fill={mine === -1 ? "currentColor" : "none"} />
          <span className="tabular-nums">{down}</span>
        </button>
      </div>
      {mine === -1 && (
        <p className="mt-2.5 text-[11px] font-medium text-[color:var(--muted)]">
          了解！次からこの場所はあなたの抽選に出てきません。
        </p>
      )}
      {mine !== -1 && isExcluded(up, down, rating?.whitelisted) && (
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
