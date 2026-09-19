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

// Key-gated proxy for the YouTube Data API. With no key it returns [] so the
// client falls back to keyless search links. search.list costs 100 quota units
// (10k/day), so the fetch is cached hard.
export async function POST(request: Request) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ items: [] as Video[] });

  let body: { query?: string };
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return NextResponse.json({ items: [] as Video[] });
  }
  const q = (body.query ?? "").trim();
  if (!q) return NextResponse.json({ items: [] as Video[] });

  try {
    const url =
      "https://www.googleapis.com/youtube/v3/search" +
      `?part=snippet&type=video&maxResults=6&safeSearch=strict` +
      `&relevanceLanguage=ja&regionCode=JP&videoEmbeddable=true` +
      `&q=${encodeURIComponent(q)}&key=${key}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json({ items: [] as Video[] });
    const data = (await res.json()) as YoutubeSearchResponse;
    const items: Video[] = (data.items ?? [])
      .filter((i) => i.id?.videoId)
      .map((i) => ({
        id: i.id!.videoId!,
        title: i.snippet?.title ?? "",
        channel: i.snippet?.channelTitle ?? "",
        thumb:
          i.snippet?.thumbnails?.medium?.url ??
          `https://i.ytimg.com/vi/${i.id!.videoId}/hqdefault.jpg`,
      }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] as Video[] });
  }
}
