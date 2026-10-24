"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useSyncExternalStore } from "react";
import { useTabiSkin } from "@/lib/tabiSkin";
import type { Pt, Scene, SceneArt, SceneParticles } from "./scenes";

export type ScenePhase = "hero" | "menu" | "step";

// The camera eases toward the scene's focus as the journey goes deeper, so
// landing → mode → compass reads as one continuous shot.
const PHASE_SCALE: Record<ScenePhase, number> = { hero: 1, menu: 1.07, step: 1.14 };
// Flat veil over the art so glass panels stay readable on later steps.
const PHASE_VEIL: Record<ScenePhase, number> = { hero: 0, menu: 0.22, step: 0.42 };

const PORTRAIT_QUERY = "(max-aspect-ratio: 4/5)";
function subscribePortrait(onChange: () => void) {
  const query = window.matchMedia(PORTRAIT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const portraitSnapshot = () => window.matchMedia(PORTRAIT_QUERY).matches;

// Small seeded PRNG so every scene lays out its sparkles, birds and leaves
// the same way on each visit.
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function insidePolygon([x, y]: Pt, polygon: readonly Pt[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

type Glint = { x: number; y: number; w: number; duration: number; delay: number };

// Sun glints scattered over the water; smaller toward the horizon.
function makeGlints(water: SceneArt["water"], seed: string): Glint[] {
  if (!water) return [];
  const rand = seeded(`${seed}:glints`);
  const glints: Glint[] = [];
  for (const polygon of water) {
    const xs = polygon.map((p) => p[0]);
    const ys = polygon.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    let placed = 0;
    for (let tries = 0; placed < 28 && tries < 800; tries += 1) {
      const point: Pt = [x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0)];
      if (!insidePolygon(point, polygon)) continue;
      const depth = (point[1] - y0) / Math.max(1, y1 - y0);
      glints.push({
        x: point[0],
        y: point[1],
        w: 0.45 + depth * 1.3 + rand() * 0.5,
        duration: 2.2 + rand() * 3.2,
        delay: -rand() * 6,
      });
      placed += 1;
    }
  }
  return glints;
}

function Gull({ flap }: { flap: number }) {
  // Wings: up → down a few beats, then a held glide.
  const up = "M2 9 C7 3 11 3 16 9 C21 3 25 3 30 9";
  const down = "M2 6 C7 10 11 10 16 9 C21 10 25 10 30 6";
  const glide = "M2 8 C7 5.5 11 5.5 16 8.5 C21 5.5 25 5.5 30 8";
  return (
    <svg viewBox="0 0 32 14" className="scene-gull block w-full" aria-hidden="true">
      <path
        d={up}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <animate
          attributeName="d"
          dur={`${flap}s`}
          repeatCount="indefinite"
          keyTimes="0;0.12;0.24;0.36;0.48;0.62;1"
          values={[up, down, up, down, up, glide, glide].join(";")}
        />
      </path>
    </svg>
  );
}

function Birds({ art, count, seed }: { art: SceneArt; count: number; seed: string }) {
  const birds = useMemo(() => {
    const rand = seeded(`${seed}:birds`);
    return Array.from({ length: count }, (_, i) => ({
      y: rand() * 100,
      size: 1.6 + rand() * 1.8,
      duration: 38 + rand() * 24,
      delay: -(i * 13 + rand() * 9),
      reverse: rand() < 0.3,
      flap: 2.2 + rand() * 0.8,
    }));
  }, [count, seed]);
  if (!art.sky) return null;
  const [left, top, width, height] = art.sky;
  return (
    <div
      className="absolute"
      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
    >
      {birds.map((bird, i) => (
        <div key={i} className="absolute inset-x-0" style={{ top: `${bird.y}%` }}>
          <div
            className="scene-fly"
            style={{
              animationDuration: `${bird.duration}s`,
              animationDelay: `${bird.delay}s`,
              animationDirection: bird.reverse ? "reverse" : "normal",
            }}
          >
            <div className="scene-bob" style={{ width: `${bird.size}%` }}>
              <Gull flap={bird.flap} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Water({ art, seed }: { art: SceneArt; seed: string }) {
  const glints = useMemo(() => makeGlints(art.water, seed), [art.water, seed]);
  return (
    <>
      {glints.map((glint, i) => (
        <span
          key={i}
          className="scene-glint"
          style={{
            left: `${glint.x}%`,
            top: `${glint.y}%`,
            width: `${glint.w}%`,
            animationDuration: `${glint.duration}s`,
            animationDelay: `${glint.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function Steam({ points }: { points: readonly Pt[] }) {
  return (
    <>
      {points.flatMap(([x, y], i) =>
        [0, 1, 2].map((k) => (
          <span
            key={`${i}-${k}`}
            className="scene-steam"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${-k * 2.2 - i}s` }}
          />
        )),
      )}
    </>
  );
}

function Lanterns({ points }: { points: readonly Pt[] }) {
  return (
    <>
      {points.map(([x, y], i) => (
        <span
          key={i}
          className="scene-lantern"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${-i * 0.7}s` }}
        />
      ))}
    </>
  );
}

const PETAL = "M6 0 C10 3 10 9 6 12 C2 9 2 3 6 0 Z";
const MAPLE =
  "M12 1 L13.6 6 L18 4 L16.6 8.6 L22 9 L17.6 12 L19.6 15.4 L14 14.6 L13 20 L12 17.6 L11 20 L10 14.6 L4.4 15.4 L6.4 12 L2 9 L7.4 8.6 L6 4 L10.4 6 Z";
const PETAL_COLORS = ["#f6b9c4", "#f3a3b2", "#fbd3da"];
const MAPLE_COLORS = ["#d94a2b", "#e8742c", "#c2361f", "#efa23a"];

function Particles({ kind, seed }: { kind: SceneParticles; seed: string }) {
  const items = useMemo(() => {
    const rand = seeded(`${seed}:${kind}`);
    const count = kind === "snow" ? 38 : 11;
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      size: kind === "snow" ? 3 + rand() * 4 : 10 + rand() * 9,
      duration: kind === "snow" ? 9 + rand() * 7 : 13 + rand() * 9,
      delay: -rand() * 20,
      sway: 3 + rand() * 3,
      tint: rand(),
    }));
  }, [kind, seed]);
  return (
    <>
      {items.map((item, i) => (
        <span
          key={i}
          className="scene-fall"
          style={{
            left: `${item.left}%`,
            animationDuration: `${item.duration}s`,
            animationDelay: `${item.delay}s`,
          }}
        >
          <span
            className={kind === "snow" ? "scene-drift-snow" : "scene-sway"}
            style={{ animationDuration: `${item.sway}s` }}
          >
            {kind === "snow" ? (
              <span
                className="block rounded-full bg-white/90 blur-[0.5px]"
                style={{ width: item.size, height: item.size }}
              />
            ) : (
              <svg
                viewBox={kind === "maple" ? "0 0 24 24" : "0 0 12 12"}
                width={item.size}
                height={item.size}
                aria-hidden="true"
              >
                <path
                  d={kind === "maple" ? MAPLE : PETAL}
                  fill={
                    kind === "maple"
                      ? MAPLE_COLORS[Math.floor(item.tint * MAPLE_COLORS.length)]
                      : PETAL_COLORS[Math.floor(item.tint * PETAL_COLORS.length)]
                  }
                  opacity={0.9}
                />
              </svg>
            )}
          </span>
        </span>
      ))}
    </>
  );
}

export function SceneBackdrop({ scene, phase }: { scene: Scene; phase: ScenePhase }) {
  const reduceMotion = useReducedMotion();
  const skin = useTabiSkin();
  const portrait = useSyncExternalStore(subscribePortrait, portraitSnapshot, () => false);
  const art = (portrait && scene.tall) || scene.wide;
  const focus = portrait && !scene.tall ? scene.tallFocus ?? art.focus : art.focus;
  const seed = `${scene.id}:${art.src}`;
  const vars = {
    "--ar": art.width / art.height,
    "--fx": focus[0],
    "--fy": focus[1],
    transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`,
  } as React.CSSProperties;

  return (
    <motion.div
      aria-hidden="true"
      className="scene-root pointer-events-none fixed inset-0 z-0 overflow-hidden"
      data-ink={scene.ink}
      data-layout={portrait ? "tall" : "wide"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      <motion.div
        className="scene-art"
        style={vars}
        initial={false}
        animate={{ scale: PHASE_SCALE[phase] }}
        transition={{ duration: reduceMotion ? 0 : 1.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={`absolute inset-0 ${reduceMotion ? "" : "scene-drift"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={art.src}
            alt=""
            draggable={false}
            className="scene-plate absolute inset-0 h-full w-full select-none"
          />
          {!reduceMotion && <Water art={art} seed={seed} />}
          {!reduceMotion && art.steam && <Steam points={art.steam} />}
          {art.lanterns && <Lanterns points={art.lanterns} />}
          {art.tabi && (
            <motion.div
              className="absolute"
              style={{ left: `${art.tabi.x}%`, top: `${art.tabi.y}%`, width: `${art.tabi.w}%` }}
              initial={{ opacity: 0, y: 14 }}
              // On the compass/prefecture steps Tabi steps into the panel instead.
              animate={phase === "step" ? { opacity: 0, y: 8 } : { opacity: 1, y: 0 }}
              transition={{ delay: phase === "step" ? 0 : 0.7, duration: 0.9, ease: "easeOut" }}
            >
              <div style={{ transform: "translate(-50%, -96%)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scene.tabiSrc}
                  alt=""
                  draggable={false}
                  style={skin.filter ? { filter: skin.filter } : undefined}
                  className={`scene-tabi w-full select-none ${reduceMotion ? "" : "scene-breathe"}`}
                />
              </div>
            </motion.div>
          )}
          {!reduceMotion && scene.birds ? (
            <Birds art={art} count={scene.birds} seed={seed} />
          ) : null}
        </div>
      </motion.div>

      {!reduceMotion && scene.particles && <Particles kind={scene.particles} seed={seed} />}

      <div className="scene-veil absolute inset-0" />
      <motion.div
        className="scene-veil-flat absolute inset-0"
        initial={false}
        animate={{ opacity: PHASE_VEIL[phase] }}
        transition={{ duration: reduceMotion ? 0 : 1.2 }}
      />
    </motion.div>
  );
}
