import { computeAround } from "@/lib/api/around";

// GET /api/nearby?lat=..&lon=..[&name=..] → { groups, menu }
// One Overpass query serves both the nearby block and (with name) the menu
// block. Coordinates are rounded (~11 m) so repeat visits share the CDN cache.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const name = (searchParams.get("name") ?? "").trim().slice(0, 80) || undefined;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return Response.json({ groups: [], menu: null }, { status: 400 });
  }

  const info = await computeAround(
    Math.round(lat * 1e4) / 1e4,
    Math.round(lon * 1e4) / 1e4,
    name,
  );
  return Response.json(info, {
    headers: {
      // Empty answers are usually a mirror hiccup — don't pin them for long.
      "Cache-Control": info.groups.length
        ? "public, s-maxage=86400, stale-while-revalidate=604800"
        : "public, s-maxage=300",
    },
  });
}
