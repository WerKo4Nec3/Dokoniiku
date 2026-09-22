import { ImageResponse } from "next/og";
import { decodeTrip } from "@/lib/tripShare";

export const runtime = "edge";

const LABELS: Record<string, string> = {
  nature: "自然",
  history: "歴史",
  shrine: "神社・寺",
  museum: "ミュージアム",
  "hot-spring": "温泉",
  food: "グルメ",
  viewpoint: "絶景",
};

function yen(n: number): string {
  return "¥" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trip = decodeTrip(searchParams.get("d") ?? "");

  const name = trip?.n ?? "旅コンパス";
  const pref = trip?.p ?? "週末の行き先";
  const km = trip?.km ?? 0;
  const cats = (trip?.c ?? []).map((c) => LABELS[c] ?? c).slice(0, 4);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #151210 0%, #2b201c 55%, #7a2e22 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700, color: "#f2a58e" }}>
          🧭　旅コンパス ・ TABI&apos;S PICK
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#fff1cf" }}>
            {pref}
          </div>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 900, lineHeight: 1.1, marginTop: 8 }}>
            {name}
          </div>
          <div style={{ display: "flex", gap: "16px", marginTop: 28, flexWrap: "wrap" }}>
            {km > 0 && (
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, background: "rgba(255,255,255,0.14)", padding: "8px 22px", borderRadius: 999 }}>
                📍 約{km}km
              </div>
            )}
            {trip?.t != null && (
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, background: "rgba(255,255,255,0.14)", padding: "8px 22px", borderRadius: 999 }}>
                🌤 {trip.t}°
              </div>
            )}
            {trip?.y ? (
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, background: "rgba(255,255,255,0.14)", padding: "8px 22px", borderRadius: 999 }}>
                💴 {yen(trip.y)}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {cats.map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                color: "#ffd8a8",
                border: "2px solid rgba(255,216,168,0.5)",
                padding: "6px 20px",
                borderRadius: 999,
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
