import type { GroupCategory } from "@/types";

export const GROUP_CATEGORIES: Record<
  GroupCategory,
  { label: string; emoji: string }
> = {
  onsen: { label: "温泉", emoji: "♨️" },
  hiking: { label: "登山・アウトドア", emoji: "⛰️" },
  gourmet: { label: "グルメ", emoji: "🍜" },
  scenery: { label: "絶景", emoji: "🌄" },
  culture: { label: "歴史・文化", emoji: "🏯" },
  drive: { label: "ドライブ", emoji: "🚗" },
  photo: { label: "写真", emoji: "📷" },
  other: { label: "その他", emoji: "🎒" },
};

export const GROUP_CATEGORY_KEYS = Object.keys(
  GROUP_CATEGORIES,
) as GroupCategory[];
