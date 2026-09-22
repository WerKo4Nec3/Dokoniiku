import type { JourneyResult } from "@/types";

// Wikimedia only renders a fixed set of thumbnail widths; anything else
// (e.g. 640 or 800) now answers HTTP 400 — which showed up as black gallery
// tiles. Verified steps: 60/120/250/330/500/960/1280/1920 (+20/40/3840).
const WIKIMEDIA_STEPS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840];
const MAX_WIDTH = 1280;

const WIKIMEDIA_THUMB = /^https:\/\/(upload|thumb)\.wikimedia\.org\/.+\/thumb\//;

// Snap a Wikimedia thumbnail URL to the nearest allowed width at or above the
// requested one. Non-Wikimedia URLs pass through unchanged.
export function normalizePhotoUrl(url: string): string;
export function normalizePhotoUrl(url: string | undefined): string | undefined;
export function normalizePhotoUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  const absolute = url.startsWith("//") ? `https:${url}` : url;
  if (!WIKIMEDIA_THUMB.test(absolute)) return absolute;
  return absolute.replace(/\/(\d+)px-/, (match, width) => {
    const w = Number(width);
    // Galleries never need more than 1280px — cap huge thumbs (MBs each).
    if (w > MAX_WIDTH) return `/${MAX_WIDTH}px-`;
    if (WIKIMEDIA_STEPS.includes(w)) return match;
    const step = WIKIMEDIA_STEPS.find((s) => s >= w) ?? MAX_WIDTH;
    return `/${step}px-`;
  });
}

// Repair photo URLs on journeys that were saved before the fix.
export function fixJourneyPhotos<T extends JourneyResult>(journey: T): T {
  const d = journey.destination;
  if (!d) return journey;
  return {
    ...journey,
    destination: {
      ...d,
      imageUrl: normalizePhotoUrl(d.imageUrl),
      images: d.images?.map((u) => normalizePhotoUrl(u)),
    },
  };
}
