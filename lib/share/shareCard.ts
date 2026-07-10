import { formatMinutes, transportLabel } from "@/lib/utils/travel";
import type { JourneyResult } from "@/types";

const WIDTH = 1200;
const HEIGHT = 630;
const FONT = '"Yu Gothic", "Hiragino Sans", "Noto Sans JP", sans-serif';

function loadImage(src: string, cors = false): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Draw an image so it covers the whole canvas (like CSS object-fit: cover).
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// Render a 1200x630 share card: place photo, name, details, the mascot,
// and the Dokoniiku brand. Returns null when rendering isn't possible.
export async function buildShareCard(
  journey: JourneyResult,
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#17271d";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wikipedia images allow CORS; fall back to the local backdrop.
  let photo = journey.destination.imageUrl
    ? await loadImage(journey.destination.imageUrl, true)
    : null;
  if (!photo) photo = await loadImage("/travel-backdrop.jpg");
  if (photo) drawCover(ctx, photo, WIDTH, HEIGHT);

  // Darken the lower half so the text reads over any photo.
  const gradient = ctx.createLinearGradient(0, HEIGHT * 0.2, 0, HEIGHT);
  gradient.addColorStop(0, "rgba(10, 20, 14, 0)");
  gradient.addColorStop(0.65, "rgba(10, 20, 14, 0.55)");
  gradient.addColorStop(1, "rgba(10, 20, 14, 0.92)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const mascot = await loadImage("/mascot/pointing.png");
  if (mascot) {
    const mw = 320;
    const mh = mw * (mascot.height / mascot.width);
    ctx.drawImage(mascot, WIDTH - mw - 28, HEIGHT - mh - 30, mw, mh);
  }

  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 12;
  ctx.textBaseline = "alphabetic";

  // Place name, shrinking until it fits beside the mascot.
  const maxTextWidth = WIDTH - 60 - 380;
  let size = 66;
  ctx.font = `bold ${size}px ${FONT}`;
  while (ctx.measureText(journey.destination.name).width > maxTextWidth && size > 34) {
    size -= 4;
    ctx.font = `bold ${size}px ${FONT}`;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillText(journey.destination.name, 60, HEIGHT - 168);

  ctx.font = `bold 28px ${FONT}`;
  ctx.fillStyle = "#e4ebe4";
  ctx.fillText(
    `${journey.prefecture.nameJa} ・ ${journey.start.name}から約${journey.distanceKm}km ・ ${transportLabel(journey.transport, journey.transfer)}で${formatMinutes(journey.estimatedTravelTime)}`,
    60,
    HEIGHT - 118,
  );

  ctx.shadowBlur = 8;
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillStyle = "#e0533a";
  ctx.fillText("Dokoniiku", 60, HEIGHT - 46);
  const brandWidth = ctx.measureText("Dokoniiku").width;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = "#c3cec4";
  ctx.fillText("dokoniiku.netlify.app", 60 + brandWidth + 24, HEIGHT - 46);

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/png"),
  );
}
