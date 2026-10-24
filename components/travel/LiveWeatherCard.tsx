"use client";

import { Cloud, CloudRain, RefreshCw, Snowflake, Sun, Sunset, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { getLiveWeather, type LiveWeather } from "@/lib/api/liveWeather";
import type { WeatherInfo } from "@/types";

const REFRESH_MS = 5 * 60 * 1000;
const ICONS: Record<WeatherInfo["icon"], typeof Sun> = { sun: Sun, cloud: Cloud, rain: CloudRain, snow: Snowflake };

// Weather at the destination right now, refreshed every 5 minutes. The
// latest reading is also handed up (for Tabi's tips).
export function LiveWeatherCard({
  latitude,
  longitude,
  onWeather,
  className = "",
}: {
  latitude: number;
  longitude: number;
  onWeather?: (weather: LiveWeather | null) => void;
  className?: string;
}) {
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    void getLiveWeather(latitude, longitude).then((value) => {
      if (!active) return;
      setLoading(false);
      if (value) {
        setWeather(value);
        setUpdatedAt(new Date());
      }
      onWeather?.(value);
    });
    const timer = window.setTimeout(() => setTick((n) => n + 1), REFRESH_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // onWeather is a setter from the parent; refetch only on place/tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, tick]);

  const Icon = weather ? ICONS[weather.icon] : Cloud;
  return (
    <section className={`rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black">現地の天気</h3>
        <button
          type="button"
          onClick={() => setTick((n) => n + 1)}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {updatedAt
            ? `${updatedAt.getHours()}:${String(updatedAt.getMinutes()).padStart(2, "0")}更新・5分ごと`
            : "取得中…"}
        </button>
      </div>
      {weather ? (
        <>
          <div className="mt-3 flex items-center gap-4">
            <Icon size={40} className={weather.icon === "sun" ? "text-sun" : "text-sky"} />
            <div>
              <p className="text-3xl font-black tabular-nums">{weather.temperature}℃</p>
              <p className="text-xs font-bold text-[color:var(--muted)]">
                {weather.description}・体感{weather.feelsLike}℃
              </p>
            </div>
            <div className="ml-auto space-y-1 text-right text-[11px] font-bold text-[color:var(--muted)]">
              <p className="inline-flex items-center gap-1">
                <Wind size={12} /> {weather.windMs}m/s
              </p>
              {weather.sunset && (
                <p className="flex items-center justify-end gap-1">
                  <Sunset size={12} className="text-vermilion" /> 日の入り {weather.sunset}
                </p>
              )}
            </div>
          </div>
          {weather.hours.length > 0 && (
            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
              {weather.hours.map((hour) => {
                const HourIcon = ICONS[hour.icon];
                return (
                  <div
                    key={hour.label}
                    className="flex min-w-[3.6rem] flex-col items-center gap-1 rounded-2xl bg-[color:var(--surface-muted)] px-2 py-2 text-[11px] font-bold"
                  >
                    <span className="text-[color:var(--muted)]">{hour.label}</span>
                    <HourIcon size={16} className={hour.icon === "sun" ? "text-sun" : "text-sky"} />
                    <span className="tabular-nums">{hour.temperature}°</span>
                    <span className={`tabular-nums ${hour.rainChance >= 50 ? "text-sky" : "text-[color:var(--muted)]"}`}>
                      ☔{hour.rainChance}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          {loading ? "天気を取得しています…" : "天気を取得できませんでした。"}
        </p>
      )}
    </section>
  );
}
