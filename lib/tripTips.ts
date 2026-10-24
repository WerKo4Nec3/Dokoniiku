import type { LiveWeather } from "@/lib/api/liveWeather";
import type { JourneyResult } from "@/types";

export type TripTip = { emoji: string; text: string };

// Tabi's advice for the trip page, from the live weather, the time of day
// and what kind of place it is. Most relevant first, a handful at most.
export function tripTips(
  journey: JourneyResult,
  weather: LiveWeather | null,
  phase: "enroute" | "exploring",
  hour: number,
): TripTip[] {
  const tips: TripTip[] = [];
  const categories = journey.destination.categories;

  if (weather) {
    const rainSoon = Math.max(0, ...weather.hours.slice(0, 3).map((h) => h.rainChance));
    if (weather.icon === "rain") {
      tips.push({ emoji: "☔", text: `いま現地は${weather.description}。屋根のある見どころや、カフェで雨宿りしながら楽しもう。` });
    } else if (rainSoon >= 50) {
      tips.push({ emoji: "🌂", text: `この先3時間で雨の確率${rainSoon}%。折りたたみ傘があると安心。` });
    }
    if (weather.icon === "snow") tips.push({ emoji: "⛄", text: "雪の予報。滑りにくい靴と、手袋を忘れずに。" });
    if (weather.feelsLike <= 8) tips.push({ emoji: "🧣", text: `体感${weather.feelsLike}℃。上着をもう一枚あると快適。` });
    if (weather.feelsLike >= 30) tips.push({ emoji: "💧", text: `体感${weather.feelsLike}℃の暑さ。こまめに水分と日陰で休憩を。` });
    if (weather.windMs >= 10) tips.push({ emoji: "🌬️", text: `風が強め（${weather.windMs}m/s）。展望台や橋の上では足元に注意。` });
    if (weather.minutesToSunset !== undefined && weather.minutesToSunset > 0 && weather.minutesToSunset <= 120) {
      tips.push({
        emoji: "🌇",
        text: `日の入りは${weather.sunset}（あと約${Math.round(weather.minutesToSunset / 10) * 10}分）。${
          categories.includes("viewpoint") ? "夕景のチャンス！" : "暗くなる前に帰りの道を確認しよう。"
        }`,
      });
    }
  }

  if (phase === "enroute") {
    if (journey.transport === "train" || journey.transport === "shinkansen") {
      tips.push({ emoji: "🚃", text: "電車は遅れることも。乗換案内で最新の時刻を確認しよう。" });
    }
    if (journey.transport === "car" || journey.transport === "motorbike") {
      tips.push({ emoji: "🅿️", text: "現地の駐車場は混みがち。到着後のページで近くの駐車場も見られるよ。" });
    }
    tips.push({ emoji: "📍", text: "着いたらタビが自動で気づくよ。「到着した！」でも記録できる。" });
  }

  if (categories.includes("hot-spring")) tips.push({ emoji: "♨️", text: "タオルと着替えを用意。湯上がりは水分補給を忘れずに。" });
  if (categories.includes("shrine")) tips.push({ emoji: "⛩️", text: "鳥居の前で一礼。参道の真ん中は神さまの通り道だよ。" });
  if (categories.includes("nature") || categories.includes("viewpoint")) {
    tips.push({ emoji: "👟", text: "歩きやすい靴で。山や海辺は天気が変わりやすいので空もチェック。" });
  }
  if (categories.includes("museum")) tips.push({ emoji: "🎫", text: "最終入館は閉館の30分前が多いよ。公式サイトで確認を。" });
  if (categories.includes("food")) tips.push({ emoji: "🍜", text: "人気店はお昼どきに行列。少し早めか遅めが狙い目。" });
  if (categories.includes("history")) tips.push({ emoji: "🏯", text: "案内板や資料館で背景を知ると、景色がもっと面白くなる。" });

  if (hour >= 17 && journey.distanceKm >= 100) {
    tips.push({ emoji: "🌙", text: `出発地から約${journey.distanceKm}km。帰りの最終便・終電は早めにチェック！` });
  }
  return tips.slice(0, 5);
}
