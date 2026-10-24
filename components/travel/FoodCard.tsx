"use client";

import { ExternalLink, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import type { FoodPlace } from "@/app/api/food/route";
import { fetchAround } from "@/lib/api/around";
import { googleMapsSearchUrl } from "@/lib/utils/travel";

type Row = {
  key: string;
  name: string;
  genre?: string;
  budget?: string;
  note?: string;
  photo?: string;
  url: string;
  distanceM: number;
};

const distance = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

// Restaurants & cafés near the destination. With a HotPepper key the list
// carries budgets; otherwise it's OpenStreetMap's eateries (no prices) with a
// Google Maps link for menus and prices.
export function FoodCard({
  latitude,
  longitude,
  placeName,
  onPlaces,
  className = "",
}: {
  latitude: number;
  longitude: number;
  placeName: string;
  onPlaces?: (places: FoodPlace[]) => void;
  className?: string;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [source, setSource] = useState<"hotpepper" | "osm" | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/food?lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}`);
        const data = (await response.json()) as { source: "hotpepper" | null; places: FoodPlace[] };
        if (!active) return;
        if (data.source === "hotpepper" && data.places.length) {
          setSource("hotpepper");
          onPlaces?.(data.places);
          setRows(
            data.places.map((place, i) => ({
              key: `hp-${i}`,
              name: place.name,
              genre: place.genre,
              budget: place.budget,
              note: place.catch,
              photo: place.photo,
              url: place.url ?? googleMapsSearchUrl(place),
              distanceM: place.distanceM,
            })),
          );
          return;
        }
      } catch {
        // fall back to OSM
      }
      const around = await fetchAround(latitude, longitude, placeName);
      if (!active) return;
      setSource("osm");
      setRows(
        (around.menu?.eateries ?? []).slice(0, 10).map((eatery, i) => ({
          key: `osm-${i}`,
          name: eatery.name,
          genre: eatery.cuisine.join("・") || undefined,
          url: eatery.website ?? googleMapsSearchUrl({ name: eatery.name, latitude, longitude }),
          distanceM: eatery.distanceM,
        })),
      );
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, placeName]);

  // No data (OSM mirrors down, nothing mapped): still offer map searches.
  const searchNear = (word: string) =>
    `https://www.google.com/maps/search/${encodeURIComponent(word)}/@${latitude},${longitude},16z`;
  return (
    <section className={`rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 ${className}`}>
      <h3 className="flex items-center gap-2 text-sm font-black">
        <Utensils size={16} className="text-vermilion" /> 近くのごはん・カフェ
      </h3>
      {rows !== null && rows.length === 0 ? (
        <div className="mt-3">
          <p className="text-xs text-[color:var(--muted)]">お店の情報を取得できませんでした。地図アプリで近くを探してみてね。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["レストラン", "カフェ", "ランチ"].map((word) => (
              <a
                key={word}
                href={searchNear(word)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] px-4 py-2 text-xs font-bold transition hover:border-vermilion/60"
              >
                {word}を探す <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </div>
      ) : rows === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-[color:var(--surface-muted)]" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.key}>
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-[color:var(--surface-muted)] p-2 pr-3 transition hover:-translate-y-0.5"
              >
                {row.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.photo} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[color:var(--surface)] text-[color:var(--muted)]">
                    <Utensils size={16} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{row.name}</span>
                  <span className="block truncate text-[11px] text-[color:var(--muted)]">
                    {[row.genre, distance(row.distanceM)].filter(Boolean).join("・")}
                  </span>
                  {row.budget && (
                    <span className="mt-0.5 inline-block rounded-full bg-sun/25 px-2 py-0.5 text-[10px] font-black text-[#7a5a05] dark:text-sun">
                      予算 {row.budget}
                    </span>
                  )}
                </span>
                <ExternalLink size={13} className="shrink-0 text-[color:var(--muted)]" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {source === "hotpepper" ? (
        <a
          href="http://webservice.recruit.co.jp/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-[10px] text-[color:var(--muted)] underline-offset-2 hover:underline"
        >
          Powered by ホットペッパーグルメ Webサービス
        </a>
      ) : (
        source === "osm" && (
          <p className="mt-3 text-[10px] text-[color:var(--muted)]">
            データ: OpenStreetMap。メニューや料金はお店のページ・Googleマップで確認してね。
          </p>
        )
      )}
    </section>
  );
}
