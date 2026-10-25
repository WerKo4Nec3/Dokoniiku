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

const LAYERS = {
  onsen: {
    query: [
      'nwr["amenity"="public_bath"]["name"]',
      'nwr["natural"="hot_spring"]["name"]',
      'nwr["leisure"="spa"]["name"]',
    ],
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
    query: [
      'nwr["tourism"="viewpoint"]["name"]',
      'nwr["natural"="waterfall"]["name"]',
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
    // The app genres each place belongs to (null: not a sight).
    classify(tags) {
      const name = tags.name ?? "";
      if (!name || isClosed(name, tags) || tags.access === "private") return null;
      if (
        tags.tourism === "viewpoint" ||
        tags.man_made === "lighthouse" ||
        (tags.man_made === "tower" && tags["tower:type"] === "observation")
      ) {
        return ["viewpoint"];
      }
      if (tags.natural === "waterfall") return ["nature"];
      if (tags.tourism === "museum" || tags.tourism === "gallery") return ["museum"];
      if (tags.historic === "castle") return ["history"];
      if (tags.highway) return /道の駅/.test(name) ? ["food"] : null;
      if (tags.craft) return ["food"];
      return null;
    },
  },
};

// Prefecture ids in JIS order.
async function loadPrefectures() {
  const source = await readFile(new URL("../data/prefectures.ts", import.meta.url), "utf8");
  const ids = [...source.matchAll(/^\s{4}id: "([a-z-]+)",$/gm)].map((m) => m[1]);
  if (ids.length !== 47) throw new Error(`expected 47 prefectures, got ${ids.length}`);
  return ids;
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

async function fetchTile(layer, s, w, size) {
  const cached = new URL(`${layer}-${s}-${w}-${size}.json`, CACHE_DIR);
  const hit = await readJson(cached, null);
  if (hit) return hit;
  const query = `[out:json][timeout:600][bbox:${s},${w},${s + size},${w + size}];
(
${LAYERS[layer].query.map((line) => `  ${line};`).join("\n")}
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
    parts.push(...(await fetchTile(layer, s + ds, w + dw, half)));
  }
  return parts;
}

// "天橋立温泉;智恵の湯" → "天橋立温泉 智恵の湯"; drops notes like "(public
// bath)" or "（座標誤差あり）".
function cleanName(name) {
  return name
    .replace(/\s*[;；]\s*/g, " ")
    .replace(/\s*\([A-Za-z ]+\)$/, "")
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
  for (const [index, [s, w]] of TILES.entries()) {
    const started = Date.now();
    const elements = await fetchTile(layer, s, w, 2);
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
        name: cleanName(tags.name),
        latitude: Math.round(lat * 1e5) / 1e5,
        longitude: Math.round(lon * 1e5) / 1e5,
        ...(genres.length ? { genres } : {}),
        ...(wiki ? { wiki } : {}),
      });
      kept += 1;
    }
    console.log(
      `tile ${index + 1}/${TILES.length} [${s},${w}]: ${elements.length} → ${kept} (${Math.round((Date.now() - started) / 1000)}s)`,
    );
  }

  // Assign prefectures, a few lookups at a time. Lookups are cached per
  // ~100 m cell and shared between layers.
  const geocodeFile = new URL("geocode.json", CACHE_DIR);
  const geocoded = await readJson(geocodeFile, {});
  const list = [...places.values()];
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
