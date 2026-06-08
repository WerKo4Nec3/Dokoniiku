import type { SearchProviderResult, WeatherInfo } from "@/types";

type OpenWeatherResponse = {
  main: { temp: number };
  weather: Array<{ main: string; description: string }>;
};

function weatherIcon(condition: string): WeatherInfo["icon"] {
  if (/rain|drizzle|thunder/i.test(condition)) return "rain";
  if (/snow/i.test(condition)) return "snow";
  if (/cloud|mist|fog/i.test(condition)) return "cloud";
  return "sun";
}

function adviceFor(icon: WeatherInfo["icon"]) {
  const advice = {
    sun: "日差し対策と飲み物を忘れずに。歩きやすい一日です。",
    cloud: "薄手の上着があると安心。写真にはやわらかな光です。",
    rain: "屋内スポットもチェックして、折りたたみ傘を持っていこう。",
    snow: "足元と交通情報を確認して、暖かくして出かけよう。",
  };
  return advice[icon];
}

export async function getWeatherByCoordinates(
  latitude: number,
  longitude: number,
): Promise<SearchProviderResult<WeatherInfo>> {
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  if (!apiKey) {
    return {
      data: {
        temperature: 22,
        description: "晴れ、ときどき雲",
        icon: "sun",
        advice: adviceFor("sun"),
        isMock: true,
      },
      provider: "mock",
      notice: "天気はデモデータです。",
    };
  }

  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      appid: apiKey,
      units: "metric",
      lang: "ja",
    });
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${params}`,
    );
    if (!response.ok) throw new Error("OpenWeather request failed");
    const result = (await response.json()) as OpenWeatherResponse;
    const icon = weatherIcon(result.weather[0]?.main ?? "Clear");

    return {
      data: {
        temperature: Math.round(result.main.temp),
        description: result.weather[0]?.description ?? "現在の天気",
        icon,
        advice: adviceFor(icon),
        isMock: false,
      },
      provider: "live",
    };
  } catch {
    return {
      data: {
        temperature: 22,
        description: "晴れ、ときどき雲",
        icon: "sun",
        advice: adviceFor("sun"),
        isMock: true,
      },
      provider: "mock",
      notice: "天気APIに接続できないため、デモ表示です。",
    };
  }
}
