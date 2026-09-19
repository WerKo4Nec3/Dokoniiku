import type { SearchProviderResult, WeatherInfo } from "@/types";

// Open-Meteo is keyless and CORS-enabled, so every visitor gets real weather
// with no API key. We lead with the coming weekend's forecast (this is a
// weekend-trip app) and fall back to the current conditions.

type OpenMeteoResponse = {
  current?: { temperature_2m: number; weather_code: number };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
  };
};

// WMO weather codes → our four-icon set + a short Japanese label.
function classify(code: number): { icon: WeatherInfo["icon"]; description: string } {
  const table: Record<number, { icon: WeatherInfo["icon"]; description: string }> = {
    0: { icon: "sun", description: "快晴" },
    1: { icon: "sun", description: "晴れ" },
    2: { icon: "cloud", description: "晴れときどき曇り" },
    3: { icon: "cloud", description: "曇り" },
    45: { icon: "cloud", description: "霧" },
    48: { icon: "cloud", description: "霧氷" },
    51: { icon: "rain", description: "霧雨" },
    53: { icon: "rain", description: "霧雨" },
    55: { icon: "rain", description: "強い霧雨" },
    56: { icon: "rain", description: "着氷性の霧雨" },
    57: { icon: "rain", description: "着氷性の霧雨" },
    61: { icon: "rain", description: "小雨" },
    63: { icon: "rain", description: "雨" },
    65: { icon: "rain", description: "大雨" },
    66: { icon: "rain", description: "みぞれ" },
    67: { icon: "rain", description: "みぞれ" },
    71: { icon: "snow", description: "小雪" },
    73: { icon: "snow", description: "雪" },
    75: { icon: "snow", description: "大雪" },
    77: { icon: "snow", description: "霧雪" },
    80: { icon: "rain", description: "にわか雨" },
    81: { icon: "rain", description: "にわか雨" },
    82: { icon: "rain", description: "激しいにわか雨" },
    85: { icon: "snow", description: "にわか雪" },
    86: { icon: "snow", description: "強いにわか雪" },
    95: { icon: "rain", description: "雷雨" },
    96: { icon: "rain", description: "雷雨（ひょう）" },
    99: { icon: "rain", description: "激しい雷雨" },
  };
  return table[code] ?? { icon: "cloud", description: "曇り" };
}

function adviceFor(icon: WeatherInfo["icon"], precipitation?: number) {
  if (typeof precipitation === "number" && precipitation >= 50 && icon !== "snow") {
    return "雨の可能性が高め。折りたたみ傘と屋内スポットも用意しておこう。";
  }
  const advice = {
    sun: "日差し対策と飲み物を忘れずに。歩きやすい一日です。",
    cloud: "薄手の上着があると安心。写真にはやわらかな光です。",
    rain: "屋内スポットもチェックして、折りたたみ傘を持っていこう。",
    snow: "足元と交通情報を確認して、暖かくして出かけよう。",
  };
  return advice[icon];
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
function isoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
// The coming weekend (Saturday), or today when it's already the weekend.
function nextWeekendISO() {
  const now = new Date();
  const dow = now.getDay(); // 0 Sun … 6 Sat
  const add = dow === 0 ? 0 : (6 - dow + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + add);
  return isoDate(target);
}

function mock(notice: string): SearchProviderResult<WeatherInfo> {
  return {
    data: {
      temperature: 22,
      description: "晴れ、ときどき雲",
      icon: "sun",
      advice: adviceFor("sun"),
      isMock: true,
    },
    provider: "mock",
    notice,
  };
}

export async function getWeatherByCoordinates(
  latitude: number,
  longitude: number,
  // A "YYYY-MM-DD" to forecast for; defaults to the coming weekend.
  targetDate?: string,
): Promise<SearchProviderResult<WeatherInfo>> {
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,weather_code",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "Asia/Tokyo",
      forecast_days: "16",
    });
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
    );
    if (!response.ok) throw new Error("Open-Meteo request failed");
    const result = (await response.json()) as OpenMeteoResponse;

    // Prefer the requested/weekend day's forecast when it's in range.
    const wanted = targetDate ?? nextWeekendISO();
    const daily = result.daily;
    const index = daily?.time?.indexOf(wanted) ?? -1;
    if (daily && index >= 0) {
      const high = Math.round(daily.temperature_2m_max[index]);
      const low = Math.round(daily.temperature_2m_min[index]);
      const precipRaw = daily.precipitation_probability_max[index];
      const precipitation =
        typeof precipRaw === "number" ? precipRaw : undefined;
      const { icon, description } = classify(daily.weather_code[index]);
      return {
        data: {
          temperature: high,
          description,
          icon,
          advice: adviceFor(icon, precipitation),
          isMock: false,
          high,
          low,
          precipitation,
          forDate: wanted,
        },
        provider: "live",
      };
    }

    // Otherwise the current conditions (still real).
    if (result.current) {
      const { icon, description } = classify(result.current.weather_code);
      return {
        data: {
          temperature: Math.round(result.current.temperature_2m),
          description,
          icon,
          advice: adviceFor(icon),
          isMock: false,
        },
        provider: "live",
      };
    }

    return mock("天気データが取得できないため、デモ表示です。");
  } catch {
    return mock("天気APIに接続できないため、デモ表示です。");
  }
}
