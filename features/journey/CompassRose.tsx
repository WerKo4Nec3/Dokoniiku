"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import type { Direction } from "@/types";

const ANGLE: Record<Direction, number> = {
  北: 0,
  北東: 45,
  東: 90,
  南東: 135,
  南: 180,
  南西: 225,
  西: 270,
  北西: 315,
};
const ORDER = Object.keys(ANGLE) as Direction[];

const round = (n: number) => Math.round(n * 100) / 100;
function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [round(r * Math.cos(a)), round(r * Math.sin(a))];
}

function wedge(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

// One point of the rose: a light and a dark facet meeting on the spine.
function RosePoint({ angle, length, width }: { angle: number; length: number; width: number }) {
  const tip = polar(length, angle);
  const left = polar(width, angle - 45);
  const right = polar(width, angle + 45);
  return (
    <>
      <path
        d={`M0 0L${tip[0]} ${tip[1]}L${left[0]} ${left[1]}Z`}
        className="fill-[color:var(--surface)] stroke-[color:var(--line)]"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d={`M0 0L${tip[0]} ${tip[1]}L${right[0]} ${right[1]}Z`}
        className="fill-[color:var(--foreground)]"
        opacity="0.5"
      />
    </>
  );
}

// The traveller's compass on the direction step. `spins` counts how many
// times it has been spun so the needle always turns forward.
export function CompassRose({
  direction,
  spinning,
  spins,
}: {
  direction: Direction | null;
  spinning: boolean;
  spins: number;
}) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const target = direction ? ANGLE[direction] : 0;
  const rotation = spins * 1080 + (spinning ? 0 : target);
  const settled = !spinning && direction;

  return (
    <div className="relative aspect-square w-full max-w-[22rem]">
      <svg viewBox="-160 -160 320 320" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id={`face-${uid}`} cx="50%" cy="38%" r="70%">
            <stop offset="0%" stopColor="var(--surface)" />
            <stop offset="100%" stopColor="var(--surface-muted)" />
          </radialGradient>
        </defs>
        <circle r="157" className="fill-[color:var(--surface)]" opacity="0.92" />
        <circle r="157" fill="none" className="stroke-[color:var(--line)]" strokeWidth="1.5" />
        <circle r="147" fill={`url(#face-${uid})`} />
        <circle r="124" fill="none" className="stroke-[color:var(--line)]" />

        {settled && (
          <motion.path
            d={wedge(64, 124, target - 22.5, target + 22.5)}
            className="fill-vermilion"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.14 }}
            transition={{ duration: 0.5 }}
          />
        )}

        {Array.from({ length: 72 }, (_, i) => i * 5).map((deg) => {
          const long = deg % 45 === 0;
          const mid = deg % 15 === 0;
          const [x1, y1] = polar(146, deg);
          const [x2, y2] = polar(146 - (long ? 14 : mid ? 9 : 5), deg);
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={long ? "stroke-[color:var(--foreground)]" : "stroke-[color:var(--muted)]"}
              strokeWidth={long ? 2 : 1}
              strokeLinecap="round"
              opacity={long ? 0.7 : 0.45}
            />
          );
        })}

        {[45, 135, 225, 315].map((angle) => (
          <RosePoint key={angle} angle={angle} length={58} width={15} />
        ))}
        {[0, 90, 180, 270].map((angle) => (
          <RosePoint key={angle} angle={angle} length={88} width={21} />
        ))}

        {ORDER.map((item) => {
          const [x, y] = polar(106, ANGLE[item]);
          const active = settled && item === direction;
          const single = item.length === 1;
          return (
            <text
              key={item}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={`font-display transition-all duration-300 ${
                active ? "fill-vermilion" : "fill-[color:var(--muted)]"
              }`}
              fontSize={single ? (active ? 21 : 17) : active ? 14 : 12}
              fontWeight={active ? 900 : 700}
            >
              {item}
            </text>
          );
        })}
      </svg>

      {/* Shadow on a static wrapper so it doesn't rotate with the needle. */}
      <div className="absolute inset-0 drop-shadow-[0_4px_5px_rgb(0_0_0_/_0.25)]">
        <motion.svg
          viewBox="-160 -160 320 320"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
          initial={false}
          animate={{ rotate: rotation }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : spinning
                ? { duration: 1.35, ease: "easeInOut" }
                : { type: "spring", stiffness: 70, damping: 7, mass: 0.9 }
          }
        >
          <defs>
            <radialGradient id={`brass-${uid}`} cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#f3d79b" />
              <stop offset="100%" stopColor="#a07a36" />
            </radialGradient>
          </defs>
          <path d="M0 -112L10 0L-10 0Z" className="fill-vermilion" />
          <path d="M0 -112L10 0L0 0Z" fill="#000" opacity="0.18" />
          <path d="M0 80L10 0L-10 0Z" className="fill-[color:var(--foreground)]" opacity="0.78" />
          <path d="M0 80L10 0L0 0Z" fill="#000" opacity="0.2" />
          <circle r="12" fill={`url(#brass-${uid})`} />
          <circle r="4.5" className="fill-[color:var(--surface)]" />
        </motion.svg>
      </div>
    </div>
  );
}
