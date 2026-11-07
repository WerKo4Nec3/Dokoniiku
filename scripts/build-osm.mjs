// Builds per-prefecture place lists from OpenStreetMap for what Wikipedia
// covers only sparsely. Run occasionally, one layer at a time:
//
//   node scripts/build-osm.mjs onsen    → public/data/onsen/<prefecture>.json
//   node scripts/build-osm.mjs sights   → public/data/sights/<prefecture>.json
//
// onsen: hot springs and onsen bathhouses (Kyoto has ~20 onsen articles on
// Wikipedia, half without coordinates). sights: viewpoints, waterfalls,
// museums, lighthouses, observation towers, castles, 道の駅 and breweries.
//
// Japan is fetched in 2°×2° land tiles from Overpass (split further when a
// tile is too heavy), then each place is assigned to its prefecture with
// GSI's reverse geocoder (the municipality code starts with the prefecture's
// JIS number, which is also the order of data/prefectures.ts). Tiles and
// lookups are cached under node_modules/.cache, so an interrupted run resumes.

import { mkdir, readFile, writeFile } from "node:fs/promises";

const MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

// South-west corners of the 2°×2° tiles that hold Japanese land, from the
// Yaeyama islands to Hokkaido (Ogasawara left out).
const TILES = [
  [24, 122], [24, 124], [26, 126], [26, 128], [28, 128], [30, 128], [30, 130],
  [32, 128], [32, 130], [32, 132], [32, 134], [32, 136], [32, 138],
  [34, 128], [34, 130], [34, 132], [34, 134], [34, 136], [34, 138], [34, 140],
  [36, 132], [36, 136], [36, 138], [36, 140],
  [38, 138], [38, 140], [40, 138], [40, 140], [40, 142],
  [42, 138], [42, 140], [42, 142], [42, 144], [44, 140], [44, 142], [44, 144],
];
const HEADERS = {
  "User-Agent": "Dokoniiku/1.0 (weekend trip picker; +https://dokoniiku.com)",
  Referer: "https://dokoniiku.com/",
};
const CACHE_DIR = new URL("../node_modules/.cache/dokoniiku-osm/", import.meta.url);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Closed for good (mappers often leave a note in the name instead).
const isClosed = (name, tags) =>
  /閉館|休業|廃業|閉業/.test(name) || Boolean(tags["disused:amenity"] || tags.disused);

const ONSEN_TYPES = new Set(["onsen", "hot_spring", "thermal"]);

// Mapped as viewpoints or lights but not somewhere you'd ride out to: car
// parks, fishing ports, harbour lights, sites of former houses or stations.
const NOT_A_VIEW =
  /駐車場|パーキング|parking|^times|漁港|駅跡|駅$|宅址|宅跡|[址跡]$|跡地|導灯|導流堤|防波堤|灯標|灯柱|指向灯|港.*灯台|鐘楼|高札場|闘牛場|ゲレンデ|トイレ|案内所|住宅$|鉄塔|アンテナ|地上局/i;

const hasJapanese = (name) => /[぀-ヿ㐀-鿿]/.test(name);

// Names that only say what the thing is ("展望台", "第2展望台", "宝物殿"):
// shown as a destination they tell you nothing about where you'd go.
const GENERIC_SIGHT =
  /^(第?[0-9０-９一二三四五]+|[東西南北]|屋上|山頂|頂上|パノラマ)?(展望(台|所|広場|デッキ|塔|テラス|スペース|休憩所|台広場|ポイント)?|見晴(らし|し)?(台|の丘|広場)?|パノラマ台|富士見台|休憩所|東屋|あずまや|火の見櫓|火の見やぐら|宝物(殿|館)|霊宝館|展示室|ギャラリー|曲がり角|股のぞき台|灯台)[0-9０-９]*$/;

const LAYERS = {
  onsen: {
    batches: {
      onsen: [
        'nwr["amenity"="public_bath"]["name"]',
        'nwr["natural"="hot_spring"]["name"]',
        'nwr["leisure"="spa"]["name"]',
      ],
    },
    // Hot springs and onsen baths; neighbourhood sento count only when their
    // name says 温泉. Foot baths and private (hotel-only) baths are left out.
    classify(tags) {
      const name = tags.name ?? "";
      const type = tags["bath:type"];
      if (!name || /足湯/.test(name) || type === "foot_bath" || isClosed(name, tags)) return null;
      if (tags.access === "private" || tags.access === "customers") return null;
      if (tags.natural === "hot_spring" || /温泉/.test(name) || ONSEN_TYPES.has(type)) return [];
      return type !== "sento" && /の湯|湯屋|スパ|spa/i.test(name) ? [] : null;
    },
  },
  sights: {
    // Fetched in separate batches, each cached on its own, so a batch added
    // later doesn't refetch the rest.
    batches: {
      sights: [
        'nwr["tourism"="viewpoint"]["name"]',
        'nwr["tourism"="museum"]["name"]',
        'nwr["tourism"="gallery"]["name"]',
        'nwr["man_made"="lighthouse"]["name"]',
        'nwr["man_made"="tower"]["tower:type"="observation"]',
        'nwr["highway"="rest_area"]["name"]',
        'nwr["highway"="services"]["name"]',
        'nwr["craft"="brewery"]["name"]',
        'nwr["craft"="winery"]["name"]',
        'nwr["craft"="distillery"]["name"]',
        'nwr["historic"="castle"]["name"]',
      ],
      // Waterfalls are mapped as waterway=waterfall (natural=waterfall is rare).
      "sights-falls": ['nwr["waterway"="waterfall"]["name"]', 'nwr["natural"="waterfall"]["name"]'],
    },
    // The app genres each place belongs to (null: not a sight).
    classify(tags) {
      const name = cleanName(tags["name:ja"] ?? tags.name ?? "");
      const wiki = Boolean(tags.wikipedia);
      if (name.length < 3 || isClosed(name, tags) || tags.access === "private") return null;
      if (GENERIC_SIGHT.test(name) || /飛行場|航空/.test(name)) return null;
      if (tags.waterway === "waterfall" || tags.natural === "waterfall") {
        // "一ノ滝" or "三のツボ" is one tier of a bigger fall, not a destination.
        return /^第?[一二三四五六七八九十0-9０-９]+[のノ]?(滝|瀧|ツボ|壺)$/.test(name) ? null : ["nature"];
      }
      if (tags.craft) return ["food"];
      if (tags.highway) return /道の駅/.test(name) ? ["food"] : null;
      // From here on an English-only name is mostly a tourist's photo spot or
      // a small private gallery.
      if (!wiki && !hasJapanese(name) && !/museum|memorial|residence|castle/i.test(name)) return null;
      if (
        tags.tourism === "viewpoint" ||
        tags.man_made === "lighthouse" ||
        (tags.man_made === "tower" && tags["tower:type"] === "observation")
      ) {
        if (!wiki && NOT_A_VIEW.test(name) && !/展望/.test(name)) return null;
        return hasJapanese(name) || wiki ? ["viewpoint"] : null;
      }
      if (tags.tourism === "museum") return ["museum"];
      // tourism=gallery is mostly shops that sell art; keep the real museums.
      if (tags.tourism === "gallery") {
        return wiki || /美術館|博物館|資料館|記念館|ミュージアム|museum/i.test(name) ? ["museum"] : null;
      }
      // Theme-park castles (USJ's Hogwarts) are mapped as castles too.
      if (tags.historic === "castle") return /ホグワーツ|シンデレラ/.test(name) ? null : ["history"];
      return null;
    },
  },
};

// Prefecture ids in JIS X 0401 order (code = index + 1), the numbering GSI's
// municipality codes start with. data/prefectures.ts lists them in a
// different order (山梨・長野 before 富山), so it can't stand in for this.
const JIS = [
  "hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima",
  "ibaraki", "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa",
  "niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano", "gifu",
  "shizuoka", "aichi", "mie", "shiga", "kyoto", "osaka", "hyogo", "nara",
  "wakayama", "tottori", "shimane", "okayama", "hiroshima", "yamaguchi",
  "tokushima", "kagawa", "ehime", "kochi", "fukuoka", "saga", "nagasaki",
  "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa",
];

// The JIS list, checked against the app's own prefecture ids.
async function loadPrefectures() {
  const source = await readFile(new URL("../data/prefectures.ts", import.meta.url), "utf8");
  const ids = new Set([...source.matchAll(/^\s{4}id: "([a-z-]+)",$/gm)].map((m) => m[1]));
  if (ids.size !== 47 || JIS.some((id) => !ids.has(id))) {
    throw new Error("data/prefectures.ts and the JIS list disagree");
  }
  return JIS;
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return fallback;
  }
}

// One query, with a retry; null when it keeps failing (the caller splits it).
async function overpass(query) {
  for (let round = 0; round < 2; round += 1) {
    for (const mirror of MIRRORS) {
      try {
        const response = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(620_000),
        });
        const json = JSON.parse(await response.text());
        if (json.remark && /error/i.test(json.remark)) throw new Error(json.remark);
        if (Array.isArray(json.elements)) return json.elements;
      } catch (error) {
        console.warn(`  ${new URL(mirror).host}: ${error.message.slice(0, 80)}`);
      }
    }
    await sleep(10_000);
  }
  return null;
}

async function fetchTile(batch, lines, s, w, size) {
  const cached = new URL(`${batch}-${s}-${w}-${size}.json`, CACHE_DIR);
  const hit = await readJson(cached, null);
  if (hit) return hit;
  const query = `[out:json][timeout:600][bbox:${s},${w},${s + size},${w + size}];
(
${lines.map((line) => `  ${line};`).join("\n")}
);
out center tags;`;
  const elements = await overpass(query);
  if (elements) {
    await writeFile(cached, JSON.stringify(elements));
    return elements;
  }
  if (size <= 0.5) throw new Error(`tile ${s},${w} keeps failing`);
  const half = size / 2;
  const parts = [];
  for (const [ds, dw] of [[0, 0], [0, half], [half, 0], [half, half]]) {
    parts.push(...(await fetchTile(batch, lines, s + ds, w + dw, half)));
  }
  return parts;
}

// "天橋立温泉;智恵の湯" → "天橋立温泉 智恵の湯"; drops notes like "(public
// bath)" or "（座標誤差あり）".
function cleanName(name) {
  return name
    .replace(/^[-‐–・\s]+/, "")
    .replace(/\s*[;；]\s*/g, " ")
    .replace(/\s*[（(][A-Za-z .'-]+[)）]$/, "")
    .replace(/\s*[（(][^（）()]*(座標|誤差)[^（）()]*[）)]$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function prefectureCode(lat, lon) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(
        `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lon}`,
        { headers: HEADERS, signal: AbortSignal.timeout(15_000) },
      );
      const json = await response.json();
      const code = json.results?.muniCd;
      return code ? Number(String(code).padStart(5, "0").slice(0, 2)) : 0;
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

async function main() {
  const layer = process.argv[2];
  if (!LAYERS[layer]) throw new Error(`usage: node scripts/build-osm.mjs <${Object.keys(LAYERS).join("|")}>`);
  await mkdir(CACHE_DIR, { recursive: true });
  const prefectureIds = await loadPrefectures();

  const places = new Map();
  for (const [batch, lines] of Object.entries(LAYERS[layer].batches)) {
    for (const [index, [s, w]] of TILES.entries()) {
      const started = Date.now();
      const elements = await fetchTile(batch, lines, s, w, 2);
      let kept = 0;
      for (const element of elements) {
        const tags = element.tags ?? {};
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;
        const genres = lat == null || lon == null ? null : LAYERS[layer].classify(tags);
        if (!genres) continue;
        const id = `osm-${element.type[0]}${element.id}`;
        if (places.has(id)) continue;
        const wiki = /^ja:(.+)$/.exec(tags.wikipedia ?? "")?.[1];
        places.set(id, {
          id,
          name: cleanName(tags["name:ja"] ?? tags.name),
          latitude: Math.round(lat * 1e5) / 1e5,
          longitude: Math.round(lon * 1e5) / 1e5,
          ...(genres.length ? { genres } : {}),
          ...(wiki ? { wiki } : {}),
        });
        kept += 1;
      }
      console.log(
        `${batch} ${index + 1}/${TILES.length} [${s},${w}]: ${elements.length} → ${kept} (${Math.round((Date.now() - started) / 1000)}s)`,
      );
    }
  }

  // The same place mapped twice (a node and the building around it, or a
  // waterfall's upper and lower tiers): one entry per name within 1 km,
  // keeping the one linked to Wikipedia.
  const byName = new Map();
  for (const place of places.values()) {
    const twins = byName.get(place.name) ?? [];
    const twin = twins.find(
      (other) => Math.hypot(other.latitude - place.latitude, (other.longitude - place.longitude) * 0.8) < 0.009,
    );
    if (!twin) {
      twins.push(place);
      byName.set(place.name, twins);
    } else if (place.wiki && !twin.wiki) {
      twins[twins.indexOf(twin)] = place;
    }
  }
  const unique = [...byName.values()].flat();

  // Assign prefectures, a few lookups at a time. Lookups are cached per
  // ~100 m cell and shared between layers.
  const geocodeFile = new URL("geocode.json", CACHE_DIR);
  const geocoded = await readJson(geocodeFile, {});
  const list = unique;
  const byPrefecture = new Map(prefectureIds.map((id) => [id, []]));
  let done = 0;
  const queue = [...list];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let place = queue.shift(); place; place = queue.shift()) {
        const cell = `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
        if (!(cell in geocoded)) {
          const code = await prefectureCode(place.latitude, place.longitude);
          if (code !== null) geocoded[cell] = code;
        }
        const id = geocoded[cell] ? prefectureIds[geocoded[cell] - 1] : null;
        if (id) byPrefecture.get(id).push(place);
        done += 1;
        if (done % 500 === 0) {
          console.log(`geocoded ${done}/${list.length}`);
          await writeFile(geocodeFile, JSON.stringify(geocoded));
        }
      }
    }),
  );
  await writeFile(geocodeFile, JSON.stringify(geocoded));

  const outDir = new URL(`../public/data/${layer}/`, import.meta.url);
  await mkdir(outDir, { recursive: true });
  let total = 0;
  for (const [id, items] of byPrefecture) {
    items.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    total += items.length;
    await writeFile(new URL(`${id}.json`, outDir), JSON.stringify(items));
  }
  console.log(`wrote ${total} ${layer} places across 47 prefectures`);
  console.log([...byPrefecture].map(([id, items]) => `${id}:${items.length}`).join(" "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
