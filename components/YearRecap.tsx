"use client";

import { useMemo, useState } from "react";
import { Download, Share2, Sparkles } from "lucide-react";
import type { SavedJourney } from "@/types";
import { categoryLabels, formatYen } from "@/lib/utils/travel";
import { computeYearRecap } from "@/lib/utils/gamification";
import { buildRecapCard } from "@/lib/share/recapCard";

// 「旅の年間まとめ」: this year's travel in a few big numbers, plus a
// story-sized image to save or share.
export function YearRecap({ journeys }: { journeys: SavedJourney[] }) {
  const year = new Date().getFullYear();
  const recap = useMemo(() => computeYearRecap(journeys, year), [journeys, year]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setDone(null);
    try {
      const blob = await buildRecapCard(recap);
      if (!blob) throw new Error("no image");
      const file = new File([blob], `tabi-recap-${year}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${year}年の旅のまとめ`,
          text: `${year}年は${recap.places}か所・${recap.prefectures}都道府県を旅しました！ #旅コンパス`,
        });
        setDone("共有しました");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setDone("画像を保存しました");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setDone("画像を作れませんでした");
    } finally {
      setBusy(false);
    }
  }

  const stats: [string, string][] = [
    ["都道府県", `${recap.prefectures}/47`],
    ["旅した距離", `${recap.km.toLocaleString("ja-JP")}km`],
    ["使った旅費", formatYen(recap.spentYen)],
    ["好きなジャンル", recap.topCategory ? categoryLabels[recap.topCategory] : "—"],
  ];

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[color:var(--line)] p-5 sm:p-6"
      style={{
        background:
          "radial-gradient(420px 280px at 100% 0%, rgb(var(--c-vermilion) / 0.16), transparent 70%), var(--surface)",
      }}
    >
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-black text-vermilion">
            <Sparkles size={14} /> TABI RECAP
          </p>
          <h3 className="mt-1 font-display text-xl font-black">{year}年の旅のまとめ</h3>
        </div>
        {recap.places > 0 && (
          <button
            type="button"
            onClick={() => void share()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-vermilion px-4 py-2 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <Share2 size={14} />
            ) : (
              <Download size={14} />
            )}
            {busy ? "作成中…" : "画像で共有"}
          </button>
        )}
      </div>

      {recap.places === 0 ? (
        <p className="relative mt-4 text-sm font-medium text-[color:var(--muted)]">
          今年はまだ「完了」した旅がありません。最初の一か所を制覇すると、ここに今年のまとめが育っていきます。
        </p>
      ) : (
        <div className="relative mt-4">
          <p className="text-xs font-bold text-[color:var(--muted)]">行ってきた場所</p>
          <p className="font-display text-5xl font-black">
            {recap.places}
            <span className="ml-1 text-xl">か所</span>
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[color:var(--surface-muted)] p-3">
                <p className="text-[11px] font-bold text-[color:var(--muted)]">{label}</p>
                <p className="mt-0.5 truncate text-lg font-black">{value}</p>
              </div>
            ))}
          </div>
          {(recap.farthest || recap.busiestMonth) && (
            <p className="mt-3 text-xs font-medium leading-6 text-[color:var(--muted)]">
              {recap.farthest && (
                <>
                  いちばん遠い旅は <b className="text-[color:var(--foreground)]">{recap.farthest.name}</b>
                  （{recap.farthest.km}km）。
                </>
              )}
              {recap.busiestMonth && (
                <>
                  いちばん旅した月は <b className="text-[color:var(--foreground)]">{recap.busiestMonth}月</b>。
                </>
              )}
            </p>
          )}
          {done && (
            <p className="mt-2 text-[11px] font-bold text-forest-ink">{done}</p>
          )}
        </div>
      )}
    </section>
  );
}
