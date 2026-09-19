import { NextResponse } from "next/server";

type Video = { id: string; title: string; channel: string; thumb: string };

type YoutubeSearchResponse = {
  items?: {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: { medium?: { url?: string } };
    };
  }[];
};

// ---- Official Data API path (used when a key is configured) ----
async function fromDataApi(key: string, q: string): Promise<Video[]> {
  const url =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=snippet&type=video&maxResults=6&safeSearch=strict` +
    `&relevanceLanguage=ja&regionCode=JP&videoEmbeddable=true` +
    `&q=${encodeURIComponent(q)}&key=${key}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const data = (await res.json()) as YoutubeSearchResponse;
  return (data.items ?? [])
    .filter((i) => i.id?.videoId)
    .map((i) => ({
      id: i.id!.videoId!,
      title: i.snippet?.title ?? "",
      channel: i.snippet?.channelTitle ?? "",
      thumb:
        i.snippet?.thumbnails?.medium?.url ??
        `https://i.ytimg.com/vi/${i.id!.videoId}/hqdefault.jpg`,
    }));
}

// ---- Keyless path: parse the search results page (server-side, no CORS,
// no key). Robust to layout shuffles by walking ytInitialData for any node
// that looks like a videoRenderer. ----
type RawVideo = {
  videoId?: string;
  title?: { runs?: { text?: string }[]; simpleText?: string };
  ownerText?: { runs?: { text?: string }[] };
  longBylineText?: { runs?: { text?: string }[] };
};

function collect(node: unknown, out: RawVideo[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  const vr = obj as RawVideo;
  if (vr.videoId && vr.title && (vr.title.runs || vr.title.simpleText)) {
    out.push(vr);
  }
  for (const key of Object.keys(obj)) collect(obj[key], out);
}

async function fromScrape(q: string): Promise<Video[]> {
  const url =
    "https://www.youtube.com/results" +
    `?search_query=${encodeURIComponent(q)}&hl=ja&gl=JP`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      "Accept-Language": "ja,en;q=0.8",
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const match = html.match(
    /ytInitialData\s*=\s*(\{[\s\S]+?\})\s*;\s*<\/script>/,
  );
  if (!match) return [];
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const raw: RawVideo[] = [];
  collect(data, raw);
  const seen = new Set<string>();
  const videos: Video[] = [];
  for (const vr of raw) {
    const id = vr.videoId!;
    if (seen.has(id)) continue;
    seen.add(id);
    const title =
      vr.title?.runs?.[0]?.text ?? vr.title?.simpleText ?? "";
    const channel =
      vr.ownerText?.runs?.[0]?.text ??
      vr.longBylineText?.runs?.[0]?.text ??
      "";
    videos.push({
      id,
      title,
      channel,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
    if (videos.length >= 6) break;
  }
  return videos;
}

export async function POST(request: Request) {
  let body: { query?: string };
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return NextResponse.json({ items: [] as Video[] });
  }
  const q = (body.query ?? "").trim();
  if (!q) return NextResponse.json({ items: [] as Video[] });

  try {
    const key = process.env.YOUTUBE_API_KEY;
    const items = key ? await fromDataApi(key, q) : await fromScrape(q);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] as Video[] });
  }
}
