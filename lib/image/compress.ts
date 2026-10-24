// Shrink a photo in the browser so it fits in one Firestore document
// (1 MiB limit): JPEG, longest side ≤ 1280px, base64 ≤ ~600 KB.
export type CompressedPhoto = {
  data: string; // base64, no "data:" prefix
  mime: "image/jpeg";
  w: number;
  h: number;
};

const BUDGET = 600_000;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // Respect EXIF rotation from phone cameras.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const image = await decode(file);
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  let side = 1280;
  let quality = 0.8;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scale = Math.min(1, side / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(image, 0, 0, w, h);
    const url = canvas.toDataURL("image/jpeg", quality);
    const data = url.slice(url.indexOf(",") + 1);
    if (data.length <= BUDGET) return { data, mime: "image/jpeg", w, h };
    side = Math.round(side * 0.8);
    quality = Math.max(0.55, quality - 0.07);
  }
  throw new Error("photo too large");
}

export const photoDataUrl = (photo: Pick<CompressedPhoto, "data" | "mime">) =>
  `data:${photo.mime};base64,${photo.data}`;
