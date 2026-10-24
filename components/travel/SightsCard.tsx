"use client";

import { ExternalLink, MapPin, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { nearbySights, type Sight } from "@/lib/api/sights";
import { googleMapsSearchUrl } from "@/lib/utils/travel";

const distance = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

// "ここで楽しむ": what's worth seeing around the destination.
export function SightsCard({
  latitude,
  longitude,
  exclude,
  onSights,
  className = "",
}: {
  latitude: number;
  longitude: number;
  exclude: string[];
  onSights?: (sights: Sight[]) => void;
  className?: string;
}) {
  const [sights, setSights] = useState<Sight[] | null>(null);
  const excludeKey = exclude.join("|");

  useEffect(() => {
    let active = true;
    void nearbySights(latitude, longitude, excludeKey.split("|")).then((list) => {
      if (!active) return;
      setSights(list);
      onSights?.(list);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, excludeKey]);

  if (sights && sights.length === 0) return null;
  return (
    <section className={`rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 ${className}`}>
      <h3 className="flex items-center gap-2 text-sm font-black">
        <Sparkles size={16} className="text-vermilion" /> ここで楽しむ
      </h3>
      <p className="mt-1 text-xs text-[color:var(--muted)]">まわり3km以内の見どころ。近い順。</p>
      {sights === null ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[color:var(--surface-muted)]" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {sights.map((sight) => (
            <li key={sight.pageid}>
              <a
                href={googleMapsSearchUrl(sight)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-[color:var(--surface-muted)] p-2 pr-3 transition hover:-translate-y-0.5"
              >
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[color:var(--line)]">
                  {sight.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sight.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[color:var(--muted)]">
                      <MapPin size={18} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{sight.name}</span>
                  {sight.description && (
                    <span className="block truncate text-[11px] text-[color:var(--muted)]">{sight.description}</span>
                  )}
                  <span className="mt-0.5 block text-[11px] font-bold text-vermilion">ここから{distance(sight.distanceM)}</span>
                </span>
                <ExternalLink size={13} className="shrink-0 text-[color:var(--muted)]" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
