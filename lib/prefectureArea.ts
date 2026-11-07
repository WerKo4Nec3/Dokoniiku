import type { Coordinates } from "@/types";

// Prefecture outlines (public/data/areas.json, built by
// scripts/build-areas.mjs from Natural Earth): per prefecture a list of
// rings, each a flat [lon, lat, lon, lat, ...] array.
type Areas = Record<string, number[][]>;
type Box = { west: number; south: number; east: number; north: number };

let areasRequest: Promise<{ areas: Areas; boxes: Map<string, Box> } | null> | null = null;

function loadAreas() {
  areasRequest ??= fetch("/data/areas.json")
    .then((response) => {
      if (!response.ok) throw new Error(`areas ${response.status}`);
      return response.json() as Promise<Areas>;
    })
    .then((areas) => {
      const boxes = new Map<string, Box>();
      for (const [id, rings] of Object.entries(areas)) {
        const box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
        for (const ring of rings) {
          for (let i = 0; i < ring.length; i += 2) {
            box.west = Math.min(box.west, ring[i]);
            box.east = Math.max(box.east, ring[i]);
            box.south = Math.min(box.south, ring[i + 1]);
            box.north = Math.max(box.north, ring[i + 1]);
          }
        }
        boxes.set(id, box);
      }
      return { areas, boxes };
    })
    .catch(() => {
      areasRequest = null; // try again next time
      return null;
    });
  return areasRequest;
}

function insideRings(rings: number[][], lon: number, lat: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i];
      const yi = ring[i + 1];
      const xj = ring[j];
      const yj = ring[j + 1];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

// Distance in km from a point to the nearest edge of the rings.
function edgeKm(rings: number[][], lon: number, lat: number): number {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const ax = (ring[j] - lon) * kx;
      const ay = (ring[j + 1] - lat) * ky;
      const dx = (ring[i] - lon) * kx - ax;
      const dy = (ring[i + 1] - lat) * ky - ay;
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

const nearBox = (box: Box, lon: number, lat: number, margin: number) =>
  lon >= box.west - margin &&
  lon <= box.east + margin &&
  lat >= box.south - margin &&
  lat <= box.north + margin;

// The outline is coarse (Natural Earth 1:10m): capes, piers and islets can
// fall just outside every prefecture. Those count for the closest one
// within this distance.
const COAST_KM = 8;

// Keeps only the places that really lie in the prefecture. Wikipedia's
// category trees cross borders (和歌山県の自然景勝地 → 瀬戸内海国立公園 →
// Kobe, Kagawa...), so a place found under one prefecture can be anywhere.
// Without the outlines (offline) everything is kept.
export async function keepInPrefecture<T extends Coordinates>(
  places: T[],
  prefectureId: string,
): Promise<T[]> {
  const loaded = await loadAreas();
  const own = loaded?.areas[prefectureId];
  if (!loaded || !own) return places;
  const { areas, boxes } = loaded;
  const ownBox = boxes.get(prefectureId)!;
  return places.filter(({ latitude: lat, longitude: lon }) => {
    // Well outside the prefecture's box: no need to look closer.
    if (!nearBox(ownBox, lon, lat, 0.1)) return false;
    if (insideRings(own, lon, lat)) return true;
    let closestOther = Infinity;
    for (const [id, rings] of Object.entries(areas)) {
      if (id === prefectureId || !nearBox(boxes.get(id)!, lon, lat, 0.1)) continue;
      if (insideRings(rings, lon, lat)) return false;
      closestOther = Math.min(closestOther, edgeKm(rings, lon, lat));
    }
    // In the sea or on an islet: the nearest coast decides (with a little
    // slack, since the outlines are rough).
    const distance = edgeKm(own, lon, lat);
    return distance <= COAST_KM && distance <= closestOther + 3;
  });
}
