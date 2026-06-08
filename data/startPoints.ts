import { DEFAULT_START } from "./prefectures";
import type { StartPoint } from "@/types";

export const startPointPresets: StartPoint[] = [
  DEFAULT_START,
  { name: "大阪・梅田", latitude: 34.7024, longitude: 135.4959 },
  { name: "京都駅", latitude: 34.9858, longitude: 135.7588 },
  { name: "名古屋駅", latitude: 35.1709, longitude: 136.8815 },
  { name: "東京駅", latitude: 35.6812, longitude: 139.7671 },
  { name: "福岡・博多駅", latitude: 33.5902, longitude: 130.4207 },
  { name: "札幌駅", latitude: 43.0686, longitude: 141.3508 },
];
