// "Menu" info for food destinations, from OpenStreetMap (keyless). There is no
// open menu database, so we surface what OSM knows about the venue itself
// (cuisine, hours, official site / menu URL) plus the closest eateries, and the
// UI adds deep links (Tabelog, Google Maps menu tab, menu-photo search).

import {
  distanceM,
  elementCoords,
  type OverpassElement,
} from "@/lib/overpass";

export type MenuVenue = {
  name: string;
  cuisine: string[];
  openingHours?: string;
  website?: string;
  menuUrl?: string;
  phone?: string;
};

export type Eatery = {
  name: string;
  cuisine: string[];
  distanceM: number;
  website?: string;
};

export type MenuInfo = { venue: MenuVenue | null; eateries: Eatery[] };

const CUISINE_JA: Record<string, string> = {
  ramen: "ラーメン", sushi: "寿司", japanese: "和食", soba: "そば", udon: "うどん",
  noodle: "麺類", curry: "カレー", coffee_shop: "カフェ", cafe: "カフェ",
  burger: "ハンバーガー", pizza: "ピザ", italian: "イタリアン", pasta: "パスタ",
  chinese: "中華", korean: "韓国料理", yakiniku: "焼肉", bbq: "焼肉・BBQ",
  tempura: "天ぷら", tonkatsu: "とんかつ", okonomiyaki: "お好み焼き",
  takoyaki: "たこ焼き", seafood: "海鮮", fish: "魚料理", izakaya: "居酒屋",
  steak_house: "ステーキ", french: "フレンチ", indian: "インド料理", thai: "タイ料理",
  ice_cream: "アイス", dessert: "スイーツ", cake: "ケーキ", sandwich: "サンドイッチ",
  chicken: "チキン", donburi: "丼", kaiseki: "懐石", western: "洋食",
  regional: "郷土料理", local: "郷土料理", teishoku: "定食", gyudon: "牛丼",
  unagi: "うなぎ", yakitori: "焼き鳥", tea: "お茶", crepe: "クレープ",
  vegetarian: "ベジタリアン", bakery: "パン", friture: "揚げ物", kebab: "ケバブ",
};

function cuisines(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .map((c) => CUISINE_JA[c] ?? c)
    .slice(0, 3);
}

function norm(s: string) {
  return s.replace(/[\s　・「」『』()（）\-‐]/g, "").toLowerCase();
}

// Pure: derive menu info from the shared "around" elements (eateries within
// ~600 m of the destination).
export function menuFromElements(
  elements: OverpassElement[],
  name: string,
  latitude: number,
  longitude: number,
): MenuInfo {
  const key = norm(name);
  let venue: MenuVenue | null = null;
  let venueScore = 0;
  const eateries: Eatery[] = [];

  for (const el of elements) {
    const tags = el.tags;
    const pos = elementCoords(el);
    if (!tags?.name || !pos) continue;
    if (!/^(restaurant|cafe|fast_food|food_court|ice_cream)$/.test(tags.amenity ?? "")) continue;
    const d = Math.round(distanceM(latitude, longitude, pos.lat, pos.lon));
    if (d > 600) continue;
    const website = tags["contact:website"] ?? tags.website;

    // Venue = the OSM eatery whose name overlaps the destination's name.
    const n = norm(tags.name);
    const overlap =
      key.length >= 2 && n.length >= 2 && (key.includes(n) || n.includes(key));
    if (overlap) {
      const score = Math.min(key.length, n.length) - d / 1000;
      if (score > venueScore) {
        venueScore = score;
        venue = {
          name: tags.name,
          cuisine: cuisines(tags.cuisine),
          openingHours: tags.opening_hours,
          website,
          menuUrl: tags["menu:url"] ?? tags["website:menu"],
          phone: tags["contact:phone"] ?? tags.phone,
        };
      }
    }
    eateries.push({ name: tags.name, cuisine: cuisines(tags.cuisine), distanceM: d, website });
  }

  eateries.sort((a, b) => a.distanceM - b.distanceM);
  return {
    venue,
    eateries: eateries.filter((e) => e.name !== venue?.name).slice(0, 5),
  };
}
