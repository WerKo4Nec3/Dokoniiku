// Builds prefecture outlines in longitude/latitude for "is this place really
// in that prefecture?" checks:
//
//   node scripts/build-areas.mjs [path/to/ne_10m_admin_1_states_provinces.geojson]
//     → public/data/areas.json  ({ <prefecture>: rings })
//
// Source: Natural Earth 1:10m admin-1 states/provinces (public domain,
// https://www.naturalearthdata.com). Downloaded from the natural-earth-vector
// repository when no local copy is given. Each prefecture is a list of outer
// rings, every ring a flat [lon, lat, lon, lat, ...] array, simplified to a
// few hundred metres — enough to tell Kobe from Wakayama, not a survey map.
// Read by lib/prefectureArea.ts, which allows for the coarse coastline.

import { mkdir, readFile, writeFile } from "node:fs/promises";

const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";

// JIS X 0401 order (code = index + 1), as in scripts/build-osm.mjs.
const JIS = [
  "hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima",
  "ibaraki", "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa",
  "niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano", "gifu",
  "shizuoka", "aichi", "mie", "shiga", "kyoto", "osaka", "hyogo", "nara",
  "wakayama", "tottori", "shimane", "okayama", "hiroshima", "yamaguchi",
  "tokushima", "kagawa", "ehime", "kochi", "fukuoka", "saga", "nagasaki",
  "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa",
];

// ~400 m: well under the tolerance the app allows around the outline.
const SIMPLIFY_DEG = 0.004;
// Islets smaller than ~0.3 km² are dropped; the app's tolerance band
// around the coast still covers the ones close to shore.
const MIN_RING_AREA_DEG2 = 0.00003;

function perpendicular(point, start, end) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy;
  if (!length) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

// Douglas–Peucker, iterative (rings run to tens of thousands of points).
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let index = -1;
    let max = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const distance = perpendicular(points[i], points[first], points[last]);
      if (distance > max) {
        index = i;
        max = distance;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    area += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  }
  return Math.abs(area / 2);
}

const round = (value) => Math.round(value * 1000) / 1000;

// Natural Earth leaves out 北山村, Wakayama's enclave between Nara and Mie
// (瀞峡 is there); a rough outline of it.
const EXTRA_RINGS = {
  wakayama: [
    [135.905, 33.905, 135.94, 33.96, 135.985, 33.98, 136.02, 33.96, 136.03, 33.905, 135.97, 33.875],
  ],
};

async function loadSource(path) {
  if (path) return JSON.parse(await readFile(path, "utf8"));
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`);
  return response.json();
}

const data = await loadSource(process.argv[2]);
const areas = {};

for (const feature of data.features) {
  const props = feature.properties ?? {};
  if (props.adm0_a3 !== "JPN") continue;
  const code = Number(String(props.iso_3166_2 ?? "").replace("JP-", ""));
  const id = JIS[code - 1];
  if (!id) throw new Error(`Unknown prefecture code ${props.iso_3166_2}`);

  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  const rings = [];
  // Outer rings only: prefectures have no holes worth keeping.
  for (const [outer] of polygons) {
    if (ringArea(outer) < MIN_RING_AREA_DEG2) continue;
    const simple = simplify(outer, SIMPLIFY_DEG);
    if (simple.length < 4) continue;
    rings.push(simple.flatMap(([lon, lat]) => [round(lon), round(lat)]));
  }
  areas[id] = [...rings, ...(EXTRA_RINGS[id] ?? [])];
}
const count = Object.keys(areas).length;
if (count !== 47) throw new Error(`Expected 47 prefectures, found ${count}`);
await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/data/areas.json", import.meta.url), JSON.stringify(areas));
console.log(`wrote ${count} prefecture outlines`);
