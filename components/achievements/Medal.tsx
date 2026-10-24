import { Lock } from "lucide-react";
import { TIER_COLORS, type Tier } from "@/lib/achievements";

// A medal: tier-coloured metal ring around the achievement's emoji.
export function Medal({
  emoji,
  tier,
  size = 56,
  locked = false,
  secret = false,
}: {
  emoji: string;
  tier: Tier;
  size?: number;
  locked?: boolean;
  secret?: boolean;
}) {
  const color = TIER_COLORS[tier];
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: locked
          ? "var(--surface-muted)"
          : `radial-gradient(circle at 30% 22%, rgb(255 255 255 / 0.75), transparent 42%), conic-gradient(from 200deg, ${color}, #ffffff 18%, ${color} 40%, color-mix(in srgb, ${color} 70%, #000) 70%, ${color})`,
        boxShadow: locked ? "none" : `0 6px 14px -6px ${color}`,
      }}
    >
      <span
        className="grid place-items-center rounded-full bg-[color:var(--surface)]"
        style={{ width: size * 0.74, height: size * 0.74, fontSize: size * 0.38 }}
      >
        {secret ? (
          <Lock size={size * 0.3} className="text-[color:var(--muted)]" />
        ) : (
          <span className={locked ? "opacity-35 grayscale" : ""}>{emoji}</span>
        )}
      </span>
    </span>
  );
}
