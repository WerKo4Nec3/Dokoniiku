import { categoryLabels, formatYen } from "@/lib/utils/travel";
import type { YearRecap } from "@/lib/utils/gamification";

// A 1080x1350 (4:5, story/feed friendly) "旅の年間まとめ" image, Spotify-Wrapped
// style, drawn on canvas in the active palette's accent.

const W = 1080;
const H = 1350;

function cssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function accentRgb(): [number, number, number] {
  const parts = cssVar("--c-vermilion", "209 66 41").split(/[\s,]+/).map(Number);
  return parts.length === 3 && parts.every(Number.isFinite)
    ? (parts as [number, number, number])
    : [209, 66, 41];
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight: string, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 18) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function buildRecapCard(recap: YearRecap): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const display = `${cssVar("--font-display", "")}, "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif`;
  const body = `${cssVar("--font-body", "")}, "Hiragino Sans", "Yu Gothic", sans-serif`;
  await document.fonts?.ready;
  const [r, g, b] = accentRgb();

  // Ink night with an accent glow.
  ctx.fillStyle = "#151210";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.8, 120, 40, W * 0.8, 120, 900);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const pad = 84;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.font = `700 34px ${body}`;
  ctx.fillText("旅コンパス ・ TABI RECAP", pad, 130);

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 92px ${display}`;
  ctx.fillText(`${recap.year}年の旅`, pad, 250);

  // Hero figure: places completed.
  ctx.fillStyle = "#f1f0ef";
  ctx.font = `700 36px ${body}`;
  ctx.fillText("行ってきた場所", pad, 360);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 220px ${display}`;
  ctx.fillText(String(recap.places), pad - 6, 560);
  const numW = ctx.measureText(String(recap.places)).width;
  ctx.font = `800 64px ${display}`;
  ctx.fillText("か所", pad + numW + 12, 560);

  // Stat tiles 2x2.
  const tiles: [string, string][] = [
    ["都道府県", `${recap.prefectures}/47`],
    ["旅した距離", `${recap.km.toLocaleString("ja-JP")}km`],
    ["使った旅費", formatYen(recap.spentYen)],
    ["好きなジャンル", recap.topCategory ? categoryLabels[recap.topCategory] : "—"],
  ];
  const tw = (W - pad * 2 - 28) / 2;
  const th = 170;
  tiles.forEach(([label, value], i) => {
    const x = pad + (i % 2) * (tw + 28);
    const y = 640 + Math.floor(i / 2) * (th + 28);
    roundRect(ctx, x, y, tw, th, 28);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.fillStyle = "#b6b2af";
    ctx.font = `700 30px ${body}`;
    ctx.fillText(label, x + 32, y + 56);
    ctx.fillStyle = "#ffffff";
    fitText(ctx, value, tw - 64, 64, "900", display);
    ctx.fillText(value, x + 32, y + 136);
  });

  // Farthest trip.
  if (recap.farthest) {
    ctx.fillStyle = "#b6b2af";
    ctx.font = `700 30px ${body}`;
    ctx.fillText("いちばん遠くへ行った旅", pad, 1080);
    ctx.fillStyle = "#ffffff";
    const line = `${recap.farthest.name}（${recap.farthest.prefecture}・${recap.farthest.km}km）`;
    fitText(ctx, line, W - pad * 2 - 220, 46, "800", display);
    ctx.fillText(line, pad, 1140);
  }

  const mascot = await loadImage("/mascot/waving.png");
  if (mascot) {
    const mh = 260;
    const mw = (mascot.width / mascot.height) * mh;
    ctx.drawImage(mascot, W - pad - mw + 20, H - mh - 60, mw, mh);
  }

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `700 28px ${body}`;
  ctx.fillText("dokoniiku.com", pad, H - 80);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
