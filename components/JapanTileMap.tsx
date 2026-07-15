"use client";

import { prefectures } from "@/data/prefectures";

// Tile-grid map of Japan: each prefecture is one square, arranged to be
// recognizably Japan-shaped (with some geographic license) — Kyushu and
// Okinawa lower-left, the Honshu arc through the middle, Hokkaido upper-right.
const tilePositions: Record<string, [col: number, row: number]> = {
  hokkaido: [13, 0],
  aomori: [13, 1],
  akita: [12, 2],
  iwate: [13, 2],
  yamagata: [12, 3],
  miyagi: [13, 3],
  niigata: [11, 4],
  fukushima: [12, 4],
  toyama: [10, 4],
  ishikawa: [9, 4],
  fukui: [9, 5],
  nagano: [10, 5],
  gunma: [11, 5],
  tochigi: [12, 5],
  ibaraki: [13, 5],
  kyoto: [8, 5],
  hyogo: [7, 5],
  tottori: [6, 5],
  shimane: [5, 5],
  shiga: [8, 6],
  gifu: [9, 6],
  yamanashi: [11, 6],
  saitama: [12, 6],
  chiba: [13, 6],
  osaka: [7, 6],
  okayama: [6, 6],
  hiroshima: [5, 6],
  yamaguchi: [4, 6],
  mie: [9, 7],
  aichi: [10, 7],
  shizuoka: [11, 7],
  tokyo: [12, 7],
  kanagawa: [12, 8],
  nara: [8, 7],
  wakayama: [7, 7],
  kagawa: [6, 7],
  ehime: [5, 7],
  tokushima: [6, 8],
  kochi: [5, 8],
  fukuoka: [3, 7],
  saga: [2, 7],
  nagasaki: [1, 7],
  oita: [3, 8],
  kumamoto: [2, 8],
  miyazaki: [3, 9],
  kagoshima: [2, 9],
  okinawa: [0, 10],
};

const nameById = new Map(prefectures.map((p) => [p.id, p.nameJa]));

const COLS = 14;
const ROWS = 11;

export function JapanTileMap({
  savedIds,
  visitedIds,
  selectedId = null,
  onSelect,
  tileSize = 18,
}: {
  savedIds: Set<string>;
  visitedIds: Set<string>;
  selectedId?: string | null;
  onSelect?: (prefectureId: string) => void;
  tileSize?: number;
}) {
  return (
    <div
      className="grid w-fit gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${COLS}, ${tileSize}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${tileSize}px)`,
      }}
      role="img"
      aria-label={`訪れた都道府県 ${visitedIds.size} / 47`}
    >
      {Object.entries(tilePositions).map(([id, [col, row]]) => {
        const visited = visitedIds.has(id);
        const saved = savedIds.has(id);
        const has = visited || saved;
        const selected = selectedId === id;
        const interactive = Boolean(onSelect) && has;

        const tone = visited
          ? "bg-vermilion"
          : saved
            ? "bg-forest/55 dark:bg-[#8fd0b9]/55"
            : "bg-[color:var(--line)]";

        const ring = selected
          ? "outline outline-2 outline-offset-1 outline-vermilion"
          : "";

        const common = `rounded-[4px] transition-colors ${tone} ${ring}`;
        const style = { gridColumn: col + 1, gridRow: row + 1 } as const;
        const label = nameById.get(id) ?? id;

        if (interactive) {
          return (
            <button
              key={id}
              type="button"
              title={`${label}${visited ? "・行った" : "・保存済み"}`}
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onSelect?.(id)}
              style={style}
              className={`${common} cursor-pointer hover:scale-125 hover:shadow-sm`}
            />
          );
        }

        return (
          <div key={id} title={label} style={style} className={common} />
        );
      })}
    </div>
  );
}
