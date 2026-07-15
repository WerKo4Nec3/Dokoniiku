import type { Difficulty } from "@/types";
import { difficultyInfo } from "@/lib/utils/travel";

// Colour token per tier. Legendary uses the animated gold class from globals.
const tierClass: Record<Difficulty, string> = {
  easy: "bg-forest/10 text-forest dark:bg-[#8fd0b9]/12 dark:text-[#8fd0b9]",
  medium: "bg-[#75b9c8]/18 text-[#2c7c8d] dark:text-[#8fd6e4]",
  hard: "bg-[#7c5cff]/14 text-[#6446c8] dark:text-[#b7a3ff]",
  epic: "bg-[#e8863e]/16 text-[#b45f1c] dark:text-[#f2ab63]",
  legendary: "difficulty-legendary",
};

export function DifficultyBadge({
  difficulty,
  className = "",
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  const info = difficultyInfo[difficulty];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${tierClass[difficulty]} ${className}`}
      title={`難易度: ${info.labelJa}`}
    >
      <span aria-hidden>{info.emoji}</span>
      {info.labelJa}
      <span aria-hidden className="tracking-[-0.1em] text-[10px]">
        {"★".repeat(info.stars)}
      </span>
    </span>
  );
}

// Frame effect applied to the card container for the rarer tiers.
export function difficultyFrameClass(difficulty: Difficulty): string {
  if (difficulty === "legendary") return "card-legendary";
  if (difficulty === "epic") return "card-epic";
  return "";
}
