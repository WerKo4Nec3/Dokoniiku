"use client";

import { skinById, useTabiSkin, type SkinEffect, type TabiPose, type TabiSkin } from "@/lib/tabiSkin";

const EFFECT_SPOTS: Record<SkinEffect, { x: number; y: number; d: number }[]> = {
  sparkle: [
    { x: 14, y: 18, d: 0 },
    { x: 84, y: 12, d: 0.7 },
    { x: 90, y: 58, d: 1.4 },
    { x: 8, y: 62, d: 2.1 },
  ],
  maple: [
    { x: 16, y: 0, d: 0 },
    { x: 70, y: -4, d: 1.6 },
    { x: 44, y: -8, d: 3.1 },
  ],
  sakura: [
    { x: 20, y: -2, d: 0 },
    { x: 76, y: -6, d: 1.3 },
    { x: 50, y: -10, d: 2.6 },
  ],
  snow: [
    { x: 12, y: -4, d: 0 },
    { x: 36, y: -8, d: 1.1 },
    { x: 62, y: -2, d: 2.2 },
    { x: 86, y: -6, d: 0.6 },
  ],
};

function EffectLayer({ effect }: { effect: SkinEffect }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {EFFECT_SPOTS[effect].map((spot, i) => (
        <span
          key={i}
          className={`skin-fx skin-fx-${effect}`}
          style={{ left: `${spot.x}%`, top: `${spot.y}%`, animationDelay: `${spot.d}s` }}
        />
      ))}
    </span>
  );
}

// One Tabi sprite wearing the chosen skin (colour filter, optional outfit
// art, optional effect). `skinId` previews a specific skin instead.
export function TabiSprite({
  pose,
  alt = "",
  className = "",
  shadow = true,
  effects = true,
  skinId,
}: {
  pose: TabiPose;
  alt?: string;
  className?: string;
  shadow?: boolean;
  effects?: boolean;
  skinId?: string;
}) {
  const chosen = useTabiSkin();
  const skin: TabiSkin = skinId ? skinById(skinId) : chosen;
  const src = skin.sprites?.[pose] ?? `/mascot/${pose}.png`;
  const filter = [skin.filter, shadow ? "drop-shadow(0 10px 12px rgb(0 0 0 / 0.18))" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={`relative block ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="h-full w-full select-none object-contain"
        style={filter ? { filter } : undefined}
      />
      {effects && skin.effect && <EffectLayer effect={skin.effect} />}
    </span>
  );
}
