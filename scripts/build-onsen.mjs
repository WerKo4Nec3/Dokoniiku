// Builds public/data/onsen/<prefecture>.json from OpenStreetMap: hot springs
// and onsen bathhouses, which Wikipedia covers only sparsely (Kyoto has ~20
// onsen articles, half without coordinates). Run occasionally:
//
//   node scripts/build-onsen.mjs
//
// Japan is fetched in 2°×2° land tiles from Overpass (split further when a
// tile is too heavy), then each place is assigned
// to its prefecture with GSI's reverse geocoder (the municipality code starts
// with the prefecture's JIS number, which is also the order of
// data/prefectures.ts).

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
const OUT_DIR = new URL("../public/data/onsen/", import.meta.url);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Prefecture ids and capitals, in JIS order.
async function loadPrefectures() {
  const source = await readFile(new URL("../data/prefectures.ts", import.meta.url), "utf8");
  const ids = [...source.matchAll(/^\s{4}id: "([a-z-]+)",$/gm)].map((m) => m[1]);
  const lats = [...source.matchAll(/^\s{4}latitude: ([\d.]+),$/gm)].map((m) => Number(m[1]));
  const lons = [...source.matchAll(/^\s{4}longitude: ([\d.]+),$/gm)].map((m) => Number(m[1]));
  if (ids.length !== 47 || lats.length !== 47 || lons.length !== 47) {
    throw new Error(`expected 47 prefectures, got ${ids.length}/${lats.length}/${lons.length}`);
  }
  return ids.map((id, i) => ({ id, lat: lats[i], lon: lons[i] }));
}

// One tile, with a retry; null when it keeps failing (the caller splits it).
async function overpass(query) {
  for (let round = 0; round < 2; round += 1) {
    for (const mirror of MIRRORS) {
      try {
        const response = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(200_000),
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

async function fetchTile(s, w, size) {
  const query = `[out:json][timeout:180][bbox:${s},${w},${s + size},${w + size}];
(
  nwr["amenity"="public_bath"]["name"];
  nwr["natural"="hot_spring"]["name"];
  nwr["leisure"="spa"]["name"];
);
out center tags;`;
  const elements = await overpass(query);
  if (elements) return elements;
  if (size <= 0.5) throw new Error(`tile ${s},${w} keeps failing`);
  const half = size / 2;
  const parts = [];
  for (const [ds, dw] of [[0, 0], [0, half], [half, 0], [half, half]]) {
    parts.push(...(await fetchTile(s + ds, w + dw, half)));
  }
  return parts;
}

const ONSEN_TYPES = new Set(["onsen", "hot_spring", "thermal"]);

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

// Hot springs and onsen baths; neighbourhood sento count only when their
// name says 温泉. Foot baths and private (hotel-only) baths are left out.
function isOnsen(tags) {
  const name = tags.name ?? "";
  const type = tags["bath:type"];
  if (!name || /足湯/.test(name) || type === "foot_bath") return false;
  // Closed for good (mappers often leave a note in the name instead).
  if (/閉館|休業|廃業|閉業/.test(name) || tags["disused:amenity"] || tags.disused) return false;
  if (tags.access === "private" || tags.access === "customers") return false;
  if (tags.natural === "hot_spring") return true;
  if (/温泉/.test(name) || ONSEN_TYPES.has(type)) return true;
  return type !== "sento" && /の湯|湯屋|スパ|spa/i.test(name);
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
      return code ? Number(String(code).padStart(5, "0").slice(0, 2)) : null;
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

async function main() {
  const prefectures = await loadPrefectures();
  const places = new Map();
  for (const [index, [s, w]] of TILES.entries()) {
    const started = Date.now();
    const elements = await fetchTile(s, w, 2);
    let kept = 0;
    for (const element of elements) {
      const tags = element.tags ?? {};
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (lat == null || lon == null || !isOnsen(tags)) continue;
      const id = `osm-${element.type[0]}${element.id}`;
      if (places.has(id)) continue;
      const wiki = /^ja:(.+)$/.exec(tags.wikipedia ?? "")?.[1];
      places.set(id, {
        id,
        name: cleanName(tags.name),
        latitude: Math.round(lat * 1e5) / 1e5,
        longitude: Math.round(lon * 1e5) / 1e5,
        ...(wiki ? { wiki } : {}),
      });
      kept += 1;
    }
    console.log(
      `tile ${index + 1}/${TILES.length} [${s},${w}]: ${elements.length} → ${kept} (${Math.round((Date.now() - started) / 1000)}s)`,
    );
    await sleep(2000);
  }

  // Assign prefectures, a few lookups at a time.
  const list = [...places.values()];
  const byPrefecture = new Map(prefectures.map((p) => [p.id, []]));
  let done = 0;
  const queue = [...list];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let place = queue.shift(); place; place = queue.shift()) {
        const code = await prefectureCode(place.latitude, place.longitude);
        const prefecture = code ? prefectures[code - 1] : null;
        if (prefecture) byPrefecture.get(prefecture.id).push(place);
        done += 1;
        if (done % 200 === 0) console.log(`geocoded ${done}/${list.length}`);
      }
    }),
  );

  await mkdir(OUT_DIR, { recursive: true });
  let total = 0;
  for (const [id, items] of byPrefecture) {
    items.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    total += items.length;
    await writeFile(new URL(`${id}.json`, OUT_DIR), JSON.stringify(items));
  }
  console.log(`wrote ${total} onsen across 47 prefectures`);
  console.log(
    [...byPrefecture].map(([id, items]) => `${id}:${items.length}`).join(" "),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
