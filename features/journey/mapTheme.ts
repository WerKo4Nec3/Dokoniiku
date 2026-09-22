// Shared map styling for the Leaflet maps (place map, reveal, shuffle).

export const JAPAN_CENTER: [number, number] = [36.6, 137.8];

// Keyless OSM tiles (CARTO now needs an API key). Dark mode darkens them with
// a CSS filter on the tile pane (see globals.css), so one URL serves both.
export function basemapUrl() {
  return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
}

export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// The palette accent as a literal colour (Leaflet writes SVG attributes, which
// can't resolve var()). Read once per map mount.
export function accentColor(): string {
  if (typeof document === "undefined") return "#d14229";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--c-vermilion")
    .trim();
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  return parts.length === 3 ? `rgb(${parts.join(",")})` : "#d14229";
}
