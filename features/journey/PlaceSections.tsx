"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Lightbulb,
  MapPinned,
  Play,
  Sparkles,
  Youtube,
} from "lucide-react";
import type { DestinationCategory } from "@/types";
import { getDestinationFacts } from "@/lib/api/wikipedia";
import {
  getNearbyPlaces,
  type NearbyCategory,
  type NearbyGroup,
} from "@/lib/api/nearby";
import { TabiMascot } from "@/features/mascot/TabiMascot";

type Video = { id: string; title: string; channel: string; thumb: string };

const CARD =
  "rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6";

// ---- 豆知識 (interesting facts) — always-visible card ----

function FactsSkeleton() {
  return (
    <ul className="mt-3 space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-1 h-4 w-4 shrink-0 rounded-full bg-[color:var(--surface-muted)]" />
          <span className="h-4 w-full animate-pulse rounded bg-[color:var(--surface-muted)]" />
        </li>
      ))}
    </ul>
  );
}

export function FactsCard({
  name,
  prefecture,
  aiEnabled,
  categories,
}: {
  name: string;
  prefecture: string;
  aiEnabled: boolean;
  categories: DestinationCategory[];
}) {
  const [facts, setFacts] = useState<string[] | null>(null);
  const [aiFacts, setAiFacts] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getDestinationFacts(name)
      .then((f) => {
        if (active) setFacts(f);
      })
      .catch(() => active && setFacts([]));
    return () => {
      active = false;
    };
  }, [name]);

  async function askAiFacts() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/place-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "facts", name, prefecture, categories }),
      });
      const data = await res.json();
      const lines = String(data.text ?? "")
        .split("\n")
        .map((l: string) => l.replace(/^[・\-\s]+/, "").trim())
        .filter(Boolean);
      setAiFacts(lines.length ? lines : ["豆知識を取得できませんでした。"]);
    } catch {
      setAiFacts(["豆知識を取得できませんでした。"]);
    } finally {
      setAiLoading(false);
    }
  }

  const empty = facts !== null && facts.length === 0 && !aiFacts;

  return (
    <div className={CARD}>
      <h3 className="inline-flex items-center gap-2 text-sm font-black">
        <Lightbulb size={16} className="text-sun" />
        豆知識
      </h3>

      {facts === null ? (
        <FactsSkeleton />
      ) : empty ? (
        <div className="mt-3 flex items-center gap-3 text-sm font-medium text-[color:var(--muted)]">
          <TabiMascot mood="thinking" size="small" />
          <p>この場所の豆知識はまだ見つからないみたい。</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {facts.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm font-medium leading-7"
            >
              <Lightbulb size={16} className="mt-1 shrink-0 text-sun" />
              <span>{f}</span>
            </li>
          ))}
          {aiFacts?.map((f, i) => (
            <li
              key={`ai-${i}`}
              className="flex items-start gap-2.5 text-sm font-medium leading-7"
            >
              <Sparkles
                size={16}
                className="mt-1 shrink-0 text-forest dark:text-[#8fd0b9]"
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {aiEnabled && !aiFacts && facts !== null && (
        <button
          type="button"
          onClick={askAiFacts}
          disabled={aiLoading}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <Sparkles size={14} />
          {aiLoading ? "タビが調べています…" : "タビにもっと豆知識を聞く"}
        </button>
      )}
      {facts !== null && (facts.length > 0 || aiFacts) && (
        <p className="mt-4 text-[10px] text-[color:var(--muted)]">
          出典: Wikipedia（日本語版）
          {aiFacts ? "・一部AI生成のため不正確な場合があります" : ""}
        </p>
      )}
    </div>
  );
}

// ---- 動画 (YouTube) — always-visible card, videos auto-load ----

function VideoSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--line)]">
      <div className="aspect-video animate-pulse bg-[color:var(--surface-muted)]" />
      <div className="p-3">
        <div className="h-3 w-3/4 animate-pulse rounded bg-[color:var(--surface-muted)]" />
      </div>
    </div>
  );
}

export function VideosCard({
  name,
  prefecture,
}: {
  name: string;
  prefecture: string;
}) {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const q = (extra = "") => `${name} ${prefecture} ${extra}`.trim();
  const searchUrl = (extra = "") =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(q(extra))}`;

  useEffect(() => {
    let active = true;
    setVideos(null);
    fetch("/api/place-videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q("観光") }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (active) setVideos(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => active && setVideos([]));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, prefecture]);

  const hasEmbeds = Boolean(videos && videos.length > 0);

  return (
    <div className={CARD}>
      <h3 className="inline-flex items-center gap-2 text-sm font-black">
        <Youtube size={16} className="text-vermilion" />
        動画
      </h3>

      <div className="mt-4">
        {videos === null && (
          <div className="grid gap-3 sm:grid-cols-2">
            <VideoSkeleton />
            <VideoSkeleton />
          </div>
        )}

        {hasEmbeds && (
          <div className="grid gap-3 sm:grid-cols-2">
            {videos!.map((v) => (
              <LiteYouTube key={v.id} {...v} />
            ))}
          </div>
        )}

        {videos !== null && (
          <div
            className={
              hasEmbeds ? "mt-5 border-t border-[color:var(--line)] pt-4" : ""
            }
          >
            {!hasEmbeds && (
              <p className="text-sm font-medium text-[color:var(--muted)]">
                動画を読み込めませんでした。YouTubeで探してみてね。
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {["観光", "グルメ", "見どころ", "空撮"].map((k) => (
                <a
                  key={k}
                  href={searchUrl(k)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[color:var(--line)] px-3 py-1.5 text-xs font-bold text-[color:var(--muted)] transition hover:border-vermilion/50 hover:text-[color:var(--foreground)]"
                >
                  #{k}
                </a>
              ))}
              <a
                href={searchUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-vermilion px-3.5 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
              >
                <Youtube size={13} /> YouTubeで検索 <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- 周辺スポット (nearby practical spots from OpenStreetMap) ----

const NEARBY_META: Record<
  NearbyCategory,
  { emoji: string; label: string; term: string }
> = {
  food: { emoji: "🍽️", label: "食事", term: "レストラン" },
  onsen: { emoji: "♨️", label: "温泉・銭湯", term: "温泉" },
  convenience: { emoji: "🏪", label: "コンビニ", term: "コンビニ" },
  station: { emoji: "🚉", label: "駅", term: "駅" },
  parking: { emoji: "🅿️", label: "駐車場", term: "駐車場" },
  toilets: { emoji: "🚻", label: "トイレ", term: "トイレ" },
};

function formatDistance(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

function NearbySkeleton() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-[color:var(--surface-muted)]"
        />
      ))}
    </div>
  );
}

export function NearbyCard({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const [groups, setGroups] = useState<NearbyGroup[] | null>(null);

  useEffect(() => {
    let active = true;
    setGroups(null);
    getNearbyPlaces(latitude, longitude)
      .then((g) => active && setGroups(g))
      .catch(() => active && setGroups([]));
    return () => {
      active = false;
    };
  }, [latitude, longitude]);

  const mapsUrl = (term: string) =>
    `https://www.google.com/maps/search/${encodeURIComponent(
      term,
    )}/@${latitude},${longitude},15z`;

  return (
    <div className={CARD}>
      <h3 className="inline-flex items-center gap-2 text-sm font-black">
        <MapPinned size={16} className="text-forest dark:text-[#8fd0b9]" />
        周辺スポット
      </h3>

      {groups === null ? (
        <NearbySkeleton />
      ) : groups.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-[color:var(--muted)]">
          この場所の周辺情報は見つかりませんでした。
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {groups.map((group) => {
            const meta = NEARBY_META[group.category];
            return (
              <a
                key={group.category}
                href={mapsUrl(meta.term)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 rounded-xl border border-[color:var(--line)] bg-[color:var(--background)] p-3 transition hover:border-forest/50"
              >
                <div className="flex items-center gap-1.5">
                  <span aria-hidden className="text-base">
                    {meta.emoji}
                  </span>
                  <span className="truncate text-sm font-black">
                    {meta.label}
                  </span>
                  <span className="ml-auto shrink-0 text-xs font-bold text-[color:var(--muted)]">
                    {group.count}
                  </span>
                </div>
                {group.nearest && (
                  <p className="mt-1.5 truncate text-[11px] font-medium text-[color:var(--muted)]">
                    {group.nearest.name}・{formatDistance(group.nearest.distanceM)}
                  </p>
                )}
              </a>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[10px] text-[color:var(--muted)]">
        データ: OpenStreetMap contributors
      </p>
    </div>
  );
}

function LiteYouTube({ id, title, thumb }: Video) {
  const [play, setPlay] = useState(false);
  return (
    <figure className="overflow-hidden rounded-lg border border-[color:var(--line)]">
      <div className="relative aspect-video bg-black/5">
        {play ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={title}
            allowFullScreen
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlay(true)}
            aria-label={`${title} を再生`}
            className="group absolute inset-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/30">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-vermilion text-white shadow-lg">
                <Play size={22} className="translate-x-0.5" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="line-clamp-2 px-3 py-2 text-xs font-bold leading-5">
        {title}
      </figcaption>
    </figure>
  );
}
