"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  ExternalLink,
  Lightbulb,
  MapPinned,
  Play,
  Sparkles,
  UtensilsCrossed,
  Youtube,
} from "lucide-react";
import type { DestinationCategory } from "@/types";
import { getDestinationFacts } from "@/lib/api/wikipedia";
import { type NearbyCategory, type NearbyGroup } from "@/lib/api/nearby";
import { fetchAround } from "@/lib/api/around";
import { type MenuInfo } from "@/lib/api/menu";
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
  className = "",
}: {
  name: string;
  prefecture: string;
  aiEnabled: boolean;
  categories: DestinationCategory[];
  className?: string;
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
    <div className={`${CARD} ${className}`}>
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
                className="mt-1 shrink-0 text-forest dark:text-forest-ink"
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
  className = "",
}: {
  name: string;
  prefecture: string;
  className?: string;
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
    <div className={`${CARD} ${className}`}>
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
  placeName = "",
  className = "",
}: {
  latitude: number;
  longitude: number;
  placeName?: string;
  className?: string;
}) {
  const [groups, setGroups] = useState<NearbyGroup[] | null>(null);

  useEffect(() => {
    let active = true;
    setGroups(null);
    fetchAround(latitude, longitude, placeName)
      .then((r) => active && setGroups(r.groups))
      .catch(() => active && setGroups([]));
    return () => {
      active = false;
    };
  }, [latitude, longitude, placeName]);

  const mapsUrl = (term: string) =>
    `https://www.google.com/maps/search/${encodeURIComponent(
      term,
    )}/@${latitude},${longitude},15z`;

  // A simple half-day flow: the place, then the nearest lunch spot and onsen.
  const course = (() => {
    if (!groups || !placeName) return [];
    const nearestOf = (c: NearbyCategory) =>
      groups.find((g) => g.category === c)?.nearest;
    const steps: {
      time: string;
      emoji: string;
      name: string;
      distanceM?: number;
    }[] = [{ time: "午前", emoji: "📍", name: placeName }];
    const food = nearestOf("food");
    if (food) steps.push({ time: "昼", emoji: "🍽️", name: food.name, distanceM: food.distanceM });
    const onsen = nearestOf("onsen");
    if (onsen) steps.push({ time: "午後", emoji: "♨️", name: onsen.name, distanceM: onsen.distanceM });
    return steps.length >= 2 ? steps : [];
  })();

  // Nothing around (or OSM unreachable): hide the block instead of an empty box.
  if (groups !== null && groups.length === 0) return null;

  return (
    <div className={`${CARD} ${className}`}>
      <h3 className="inline-flex items-center gap-2 text-sm font-black">
        <MapPinned size={16} className="text-forest dark:text-forest-ink" />
        周辺スポット
      </h3>

      {course.length >= 2 && (
        <div className="mt-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--background)] p-3">
          <p className="text-xs font-black">モデルコース（半日）</p>
          <ol className="mt-2 space-y-2">
            {course.map((step, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-[10px] font-black text-vermilion">
                  {step.time}
                </span>
                <span aria-hidden>{step.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                  {step.name}
                </span>
                {step.distanceM != null && (
                  <span className="shrink-0 text-[10px] font-medium text-[color:var(--muted)]">
                    {formatDistance(step.distanceM)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {groups === null ? (
        <NearbySkeleton />
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

// ---- メニュー (food destinations) ----

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] px-3 py-1.5 text-xs font-bold text-[color:var(--muted)] transition hover:border-vermilion/50 hover:text-[color:var(--foreground)]"
    >
      {children}
      <ExternalLink size={11} />
    </a>
  );
}

export function MenuCard({
  name,
  prefecture,
  latitude,
  longitude,
  aiEnabled,
  className = "",
}: {
  name: string;
  prefecture: string;
  latitude: number;
  longitude: number;
  aiEnabled: boolean;
  className?: string;
}) {
  const [info, setInfo] = useState<MenuInfo | null>(null);
  const [aiMenu, setAiMenu] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setInfo(null);
    fetchAround(latitude, longitude, name).then(
      (r) => active && setInfo(r.menu ?? { venue: null, eateries: [] }),
    );
    return () => {
      active = false;
    };
  }, [name, latitude, longitude]);

  async function askAiMenu() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/place-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "menu", name, prefecture, categories: ["food"] }),
      });
      const data = await res.json();
      const lines = String(data.text ?? "")
        .split("\n")
        .map((l: string) => l.replace(/^[・\-\s]+/, "").trim())
        .filter(Boolean);
      setAiMenu(lines.length ? lines : ["メニューを取得できませんでした。"]);
    } catch {
      setAiMenu(["メニューを取得できませんでした。"]);
    } finally {
      setAiLoading(false);
    }
  }

  const q = `${name} ${prefecture}`;
  const venue = info?.venue ?? null;

  return (
    <div className={`${CARD} ${className}`}>
      <h3 className="inline-flex items-center gap-2 text-sm font-black">
        <UtensilsCrossed size={16} className="text-vermilion" />
        メニュー
      </h3>

      {info === null && (
        <div className="mt-3 h-16 animate-pulse rounded-lg bg-[color:var(--surface-muted)]" />
      )}

      {venue && (
        <div className="mt-3 rounded-lg bg-[color:var(--surface-muted)] p-3">
          <p className="text-sm font-black">{venue.name}</p>
          {venue.cuisine.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {venue.cuisine.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-vermilion/10 px-2.5 py-0.5 text-[11px] font-bold text-vermilion"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          {venue.openingHours && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-[color:var(--muted)]">
              <Clock size={13} className="mt-0.5 shrink-0" />
              <span className="break-all">{venue.openingHours}</span>
            </p>
          )}
          {(venue.menuUrl || venue.website) && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {venue.menuUrl && (
                <a
                  href={venue.menuUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-vermilion px-3 py-1.5 text-xs font-black text-white transition hover:opacity-90"
                >
                  公式メニューを見る <ExternalLink size={11} />
                </a>
              )}
              {venue.website && (
                <MenuLink href={venue.website}>公式サイト</MenuLink>
              )}
            </div>
          )}
        </div>
      )}

      {aiMenu && (
        <ul className="mt-3 space-y-2">
          {aiMenu.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-sm font-medium leading-6">
              <Sparkles size={15} className="mt-1 shrink-0 text-vermilion" />
              <span>{line}</span>
            </li>
          ))}
          <li className="text-[10px] text-[color:var(--muted)]">
            AIによる推定です。実際のメニューはお店の情報を確認してね。
          </li>
        </ul>
      )}

      {aiEnabled && !aiMenu && (
        <button
          type="button"
          onClick={askAiMenu}
          disabled={aiLoading}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <Sparkles size={14} />
          {aiLoading ? "タビが調べています…" : "タビに名物メニューを聞く"}
        </button>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <MenuLink href={`https://www.google.com/search?q=${encodeURIComponent(`${q} site:tabelog.com`)}`}>
          食べログで見る
        </MenuLink>
        <MenuLink href={`https://www.google.com/maps/search/${encodeURIComponent(q)}`}>
          Googleマップ（メニュー・写真）
        </MenuLink>
        <MenuLink href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${name} メニュー`)}`}>
          メニューの写真
        </MenuLink>
      </div>

      {info && info.eateries.length > 0 && (
        <div className="mt-4 border-t border-[color:var(--line)] pt-3">
          <p className="text-xs font-black text-[color:var(--muted)]">近くのお店</p>
          <ul className="mt-2 space-y-1.5">
            {info.eateries.map((e) => (
              <li key={`${e.name}-${e.distanceM}`} className="flex items-center gap-2 text-sm">
                <a
                  href={e.website ?? `https://www.google.com/maps/search/${encodeURIComponent(`${e.name} ${prefecture}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate font-bold underline-offset-2 hover:underline"
                >
                  {e.name}
                </a>
                {e.cuisine[0] && (
                  <span className="shrink-0 text-[11px] font-bold text-vermilion">{e.cuisine[0]}</span>
                )}
                <span className="shrink-0 text-[11px] text-[color:var(--muted)]">
                  {formatDistance(e.distanceM)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[10px] text-[color:var(--muted)]">
        データ: OpenStreetMap ほか。営業時間・メニューは変わることがあります。
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
