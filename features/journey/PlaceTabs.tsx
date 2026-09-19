"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Info,
  Lightbulb,
  Play,
  Sparkles,
  Youtube,
} from "lucide-react";
import type { DestinationCategory } from "@/types";
import { getDestinationFacts } from "@/lib/api/wikipedia";
import { TabiMascot } from "@/features/mascot/TabiMascot";

type TabId = "overview" | "facts" | "videos";
type Video = { id: string; title: string; channel: string; thumb: string };

const youtubeEnabled = process.env.NEXT_PUBLIC_YOUTUBE_ENABLED === "true";

const TABS: { id: TabId; label: string; Icon: typeof Info }[] = [
  { id: "overview", label: "概要", Icon: Info },
  { id: "facts", label: "豆知識", Icon: Lightbulb },
  { id: "videos", label: "動画", Icon: Youtube },
];

export function PlaceTabs({
  name,
  prefecture,
  categories,
  aiEnabled,
  children,
}: {
  name: string;
  prefecture: string;
  categories: DestinationCategory[];
  aiEnabled: boolean;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6">
      <div
        role="tablist"
        aria-label="場所の詳細"
        className="inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-1"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                active
                  ? "bg-vermilion text-white shadow-sm shadow-vermilion/30"
                  : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "overview" && children}
        {tab === "facts" && (
          <FactsTab
            name={name}
            prefecture={prefecture}
            aiEnabled={aiEnabled}
            categories={categories}
          />
        )}
        {tab === "videos" && <VideosTab name={name} prefecture={prefecture} />}
      </div>
    </div>
  );
}

function FactsSkeleton() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-1 h-4 w-4 shrink-0 rounded-full bg-[color:var(--surface-muted)]" />
          <span className="h-4 w-full animate-pulse rounded bg-[color:var(--surface-muted)]" />
        </li>
      ))}
    </ul>
  );
}

function FactsTab({
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

  if (facts === null) return <FactsSkeleton />;

  const empty = facts.length === 0 && !aiFacts;
  return (
    <div>
      {empty ? (
        <div className="flex items-center gap-3 text-sm font-medium text-[color:var(--muted)]">
          <TabiMascot mood="thinking" size="small" />
          <p>
            この場所の豆知識はまだ見つからないみたい。概要タブをのぞいてみてね。
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
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

      {aiEnabled && !aiFacts && (
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
      {(facts.length > 0 || aiFacts) && (
        <p className="mt-4 text-[10px] text-[color:var(--muted)]">
          出典: Wikipedia（日本語版）
          {aiFacts ? "・一部AI生成のため不正確な場合があります" : ""}
        </p>
      )}
    </div>
  );
}

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

function VideosTab({ name, prefecture }: { name: string; prefecture: string }) {
  const [videos, setVideos] = useState<Video[] | null>(
    youtubeEnabled ? null : [],
  );
  const q = (extra = "") => `${name} ${prefecture} ${extra}`.trim();
  const searchUrl = (extra = "") =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(q(extra))}`;

  useEffect(() => {
    if (!youtubeEnabled) return;
    let active = true;
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
    <div>
      {youtubeEnabled && videos === null && (
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

      <div
        className={
          hasEmbeds ? "mt-5 border-t border-[color:var(--line)] pt-4" : ""
        }
      >
        <p className="text-sm font-medium text-[color:var(--muted)]">
          {name}の動画をYouTubeで探す
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
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
        </div>
        <a
          href={searchUrl()}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-vermilion px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
        >
          <Youtube size={14} /> YouTubeで検索 <ExternalLink size={12} />
        </a>
      </div>
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
