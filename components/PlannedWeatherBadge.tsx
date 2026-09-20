"use client";

import { useEffect, useState } from "react";
import { getWeatherByCoordinates } from "@/lib/api/weather";
import type { WeatherInfo } from "@/types";

const ICON_EMOJI: Record<WeatherInfo["icon"], string> = {
  sun: "☀️",
  cloud: "☁️",
  rain: "🌧️",
  snow: "❄️",
};

function daysUntil(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - midnight) / 86400000);
}

// A compact forecast chip for a scheduled trip's date. Only shows when the day
// is within Open-Meteo's forecast window (today … +16 days).
export function PlannedWeatherBadge({
  latitude,
  longitude,
  date,
}: {
  latitude: number;
  longitude: number;
  date: string;
}) {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const inRange = (() => {
    const d = daysUntil(date);
    return d >= 0 && d <= 16;
  })();

  useEffect(() => {
    if (!inRange) return;
    let active = true;
    getWeatherByCoordinates(latitude, longitude, date)
      .then((res) => {
        if (active && !res.data.isMock && res.data.forDate === date) {
          setWeather(res.data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [latitude, longitude, date, inRange]);

  if (!inRange || !weather) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky/10 px-2 py-0.5 text-[11px] font-bold text-[#3f8ea0] dark:text-sky">
      <span aria-hidden>{ICON_EMOJI[weather.icon]}</span>
      {weather.temperature}°
      {weather.precipitation != null && weather.precipitation >= 30 && (
        <span className="text-[color:var(--muted)]">☔{weather.precipitation}%</span>
      )}
    </span>
  );
}
