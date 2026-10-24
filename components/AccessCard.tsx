"use client";

import { useEffect, useState } from "react";
import { Car, ExternalLink, Footprints, TrainFront } from "lucide-react";
import { fetchAround } from "@/lib/api/around";

// 「アクセス」: the nearest station (from the same cached OSM lookup the nearby
// block uses — no extra request) plus one-tap real routes, since our travel
// time is only an estimate.

function stationName(label: string): string | null {
  // "神戸・三宮" → "三宮", "京都駅" → "京都", "福岡・博多駅" → "博多"
  if (!label || /現在地|現在位置/.test(label)) return null;
  const last = label.split("・").pop() ?? label;
  const name = last.replace(/駅$/, "").trim();
  return name.length >= 2 ? name : null;
}

function walkLabel(m: number): string {
  if (m <= 2500) return `徒歩約${Math.max(1, Math.round(m / 80))}分`;
  return `約${(m / 1000).toFixed(1)}km`;
}

export function AccessCard({
  start,
  destination,
  className = "",
}: {
  start: { name: string; latitude: number; longitude: number };
  destination: { name: string; latitude: number; longitude: number };
  className?: string;
}) {
  const [station, setStation] = useState<{ name: string; distanceM: number } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    setStation(null);
    fetchAround(destination.latitude, destination.longitude, destination.name).then(
      (r) => {
        const near = r.groups.find((g) => g.category === "station")?.nearest;
        if (active && near) setStation(near);
      },
    );
    return () => {
      active = false;
    };
  }, [destination.latitude, destination.longitude, destination.name]);

  const origin = `${start.latitude},${start.longitude}`;
  const dest = `${destination.latitude},${destination.longitude}`;
  const gmaps = (mode: "transit" | "driving") =>
    `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${mode}`;

  const fromStation = stationName(start.name);
  const toStation = station ? station.name.replace(/駅$/, "") : null;
  const yahoo =
    fromStation && toStation
      ? `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(fromStation)}&to=${encodeURIComponent(toStation)}`
      : null;

  const btn =
    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--line)] px-3 py-2.5 text-xs font-black transition hover:border-vermilion/50 hover:text-vermilion";

  return (
    <div
      className={`rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 ${className}`}
    >
      <p className="text-xs font-bold text-[color:var(--muted)]">アクセス</p>
      {station ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black">
          <TrainFront size={16} className="text-forest-ink" />
          最寄り駅 {toStation}駅
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--muted)]">
            <Footprints size={13} />
            {walkLabel(station.distanceM)}
          </span>
        </p>
      ) : (
        <p className="mt-2 text-xs font-medium text-[color:var(--muted)]">
          実際の経路と時刻はこちらで確認できます。
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={gmaps("transit")} target="_blank" rel="noreferrer" className={btn}>
          <TrainFront size={14} /> 電車で行く
        </a>
        <a href={gmaps("driving")} target="_blank" rel="noreferrer" className={btn}>
          <Car size={14} /> 車で行く
        </a>
        {yahoo && (
          <a href={yahoo} target="_blank" rel="noreferrer" className={btn}>
            乗換案内 <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
