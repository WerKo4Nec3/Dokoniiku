"use client";

import { prefectures } from "@/data/prefectures";

// Tile-grid map of Japan: each prefecture is one square, arranged to be
// recognizably Japan-shaped (with some geographic license).
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

export function JapanTileMap({
  savedIds,
  visitedIds,
}: {
  savedIds: Set<string>;
  visitedIds: Set<string>;
}) {
  return (
    <div
      className="grid w-fit gap-[3px]"
      style={{
        gridTemplateColumns: "repeat(14, 14px)",
        gridTemplateRows: "repeat(11, 14px)",
      }}
      role="img"
      aria-label={`訪れた都道府県 ${visitedIds.size} / 47`}
    >
      {Object.entries(tilePositions).map(([id, [col, row]]) => {
        const visited = visitedIds.has(id);
        const saved = savedIds.has(id);
        return (
          <div
            key={id}
            title={nameById.get(id) ?? id}
            style={{ gridColumn: col + 1, gridRow: row + 1 }}
            className={`rounded-[3px] transition-colors ${
              visited
                ? "bg-vermilion"
                : saved
                  ? "bg-forest/50 dark:bg-[#8fd0b9]/50"
                  : "bg-[color:var(--line)]"
            }`}
          />
        );
      })}
    </div>
  );
}
