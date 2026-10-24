import { classify } from "@/lib/api/weather";
import type { WeatherInfo } from "@/types";

// Weather right now at a place, plus the next few hours (Open-Meteo,
// keyless). Used by the "旅の途中" page, which refreshes it every 5 minutes.

export type LiveWeather = {
  temperature: number;
  feelsLike: number;
  icon: WeatherInfo["icon"];
  description: string;
  windMs: number;
  humidity: number;
  /** Next hours: "14時", °C, chance of rain %, icon. */
  hours: { label: string; temperature: number; rainChance: number; icon: WeatherInfo["icon"] }[];
  sunrise?: string;
  sunset?: string;
  /** Minutes until sunset (negative after it). */
  minutesToSunset?: number;
};

type Response = {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
  };
  hourly?: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[] };
  daily?: { sunrise?: string[]; sunset?: string[] };
};

const hhmm = (iso?: string) => {
  const m = iso?.match(/T(\d{2}):(\d{2})/);
  return m ? `${Number(m[1])}:${m[2]}` : undefined;
};
const minutesOf = (iso: string) => {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

export async function getLiveWeather(latitude: number, longitude: number): Promise<LiveWeather | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m",
      hourly: "temperature_2m,precipitation_probability,weather_code",
      forecast_hours: "7",
      daily: "sunrise,sunset",
      forecast_days: "1",
      wind_speed_unit: "ms",
      timezone: "Asia/Tokyo",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as Response;
    if (!data.current) return null;
    const { icon, description } = classify(data.current.weather_code);
    const sunset = data.daily?.sunset?.[0];
    const hourly = data.hourly;
    return {
      temperature: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      icon,
      description,
      windMs: Math.round(data.current.wind_speed_10m * 10) / 10,
      humidity: Math.round(data.current.relative_humidity_2m),
      hours: hourly
        ? hourly.time.slice(1, 7).map((time, i) => ({
            label: `${Number(time.slice(11, 13))}時`,
            temperature: Math.round(hourly.temperature_2m[i + 1]),
            rainChance: hourly.precipitation_probability[i + 1] ?? 0,
            icon: classify(hourly.weather_code[i + 1]).icon,
          }))
        : [],
      sunrise: hhmm(data.daily?.sunrise?.[0]),
      sunset: hhmm(sunset),
      minutesToSunset: sunset ? minutesOf(sunset) - minutesOf(data.current.time) : undefined,
    };
  } catch {
    return null;
  }
}
