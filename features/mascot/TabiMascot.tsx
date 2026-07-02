"use client";

import { motion, useReducedMotion } from "framer-motion";

type MascotMood = "idle" | "excited" | "thinking" | "reveal" | "walking";

const moodImage: Record<MascotMood, string> = {
  idle: "/mascot/waving.png",
  thinking: "/mascot/map.png",
  walking: "/mascot/walking.png",
  excited: "/mascot/camera.png",
  reveal: "/mascot/pointing.png",
};

const moodLabel: Record<MascotMood, string> = {
  idle: "旅の精タビが手をふっている",
  thinking: "旅の精タビが地図を見て考え中",
  walking: "旅の精タビが歩いて向かっている",
  excited: "旅の精タビがカメラを構えている",
  reveal: "旅の精タビが行き先を指さしている",
};

const sizeClass: Record<"small" | "medium" | "large", string> = {
  small: "h-24 w-24",
  medium: "h-40 w-40",
  large: "h-48 w-48",
};

export function TabiMascot({
  mood = "idle",
  size = "large",
}: {
  mood?: MascotMood;
  size?: "small" | "medium" | "large";
}) {
  const reducedMotion = useReducedMotion();
  const animation = reducedMotion
    ? undefined
    : mood === "thinking"
      ? { y: [0, -12, 0], rotate: [0, 6, -6, 0] }
      : mood === "excited"
        ? { y: [0, -16, 0], scale: [1, 1.06, 1] }
        : mood === "walking"
          ? { y: [0, -6, 0], x: [0, 5, -5, 0] }
          : mood === "reveal"
            ? { y: [16, -6, 0], rotate: [-6, 3, 0] }
            : { y: [0, -7, 0], rotate: [0, 1.5, -1.5, 0] };

  return (
    <motion.div
      className={sizeClass[size]}
      animate={animation}
      transition={{
        duration: mood === "thinking" ? 0.9 : mood === "walking" ? 0.6 : 2.8,
        repeat: mood === "reveal" ? 0 : Infinity,
        ease: "easeInOut",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={moodImage[mood]}
        alt={moodLabel[mood]}
        className="h-full w-full object-contain drop-shadow-xl"
      />
    </motion.div>
  );
}
