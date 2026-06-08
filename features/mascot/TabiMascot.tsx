"use client";

import { motion, useReducedMotion } from "framer-motion";

type MascotMood = "idle" | "excited" | "thinking" | "reveal";

export function TabiMascot({
  mood = "idle",
  size = "large",
}: {
  mood?: MascotMood;
  size?: "small" | "large";
}) {
  const reducedMotion = useReducedMotion();
  const animation = reducedMotion
    ? undefined
    : mood === "thinking"
      ? { y: [0, -14, 0], rotate: [0, 8, -8, 0] }
      : mood === "excited"
        ? { y: [0, -20, 0], scale: [1, 1.08, 1] }
        : mood === "reveal"
          ? { y: [16, -6, 0], rotate: [-8, 3, 0] }
          : { y: [0, -7, 0], rotate: [0, 1.5, -1.5, 0] };

  return (
    <motion.div
      className={size === "large" ? "h-48 w-48" : "h-24 w-24"}
      animate={animation}
      transition={{
        duration: mood === "thinking" ? 0.75 : 2.8,
        repeat: mood === "reveal" ? 0 : Infinity,
        ease: "easeInOut",
      }}
      aria-label={`旅の精タビ、${mood === "thinking" ? "行き先を考え中" : "案内中"}`}
      role="img"
    >
      <svg viewBox="0 0 220 220" className="h-full w-full drop-shadow-xl">
        <path
          d="M52 78C61 42 91 25 121 34c37 10 61 52 49 91-11 38-47 68-85 56-36-11-49-61-33-103Z"
          fill="#fffaf0"
          stroke="#1f2924"
          strokeWidth="6"
        />
        <path
          d="M68 64c9-27 40-43 68-30l-8 18c-19-8-38 1-45 18Z"
          fill="#e8583e"
          stroke="#1f2924"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="M128 51c16-8 36-2 42 13-13 2-27 9-38 19Z"
          fill="#f2c14e"
          stroke="#1f2924"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <circle cx="91" cy="106" r="7" fill="#1f2924" />
        <circle cx="137" cy="106" r="7" fill="#1f2924" />
        <path
          d={mood === "excited" || mood === "reveal" ? "M99 127c9 12 23 12 32 0" : "M101 129c8 5 18 5 26 0"}
          fill="none"
          stroke="#1f2924"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <circle cx="75" cy="124" r="9" fill="#f5a697" opacity=".7" />
        <circle cx="153" cy="124" r="9" fill="#f5a697" opacity=".7" />
        <path
          d="M61 143c-18 4-29 16-32 32 18 1 35-8 43-24M155 153c18 5 29 17 31 33-18 0-34-10-42-26"
          fill="#75b9c8"
          stroke="#1f2924"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
        <path
          d="M99 179c-2 13-10 21-22 24M126 180c3 12 11 19 23 22"
          fill="none"
          stroke="#1f2924"
          strokeLinecap="round"
          strokeWidth="7"
        />
        <path
          d="M111 48 98 19M98 22l10 4 6-9"
          fill="none"
          stroke="#1f2924"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
      </svg>
    </motion.div>
  );
}
