import { seasonForDate, type Season } from "@/lib/utils/travel";

// Landing "scenes": one painted plate per scene, with the moving parts
// (birds, water glints, falling leaves, steam, Tabi) layered on top in code.
// All coordinates are percentages of the art itself, so overlays stay pinned
// to the painting however it is cropped to the screen.
//
// Adding a scene: drop the plate(s) into /public/scenes, then add an entry
// below — trace the water with a few points, mark where Tabi sits, and pick
// the sky band the birds cross.

export type Pt = readonly [number, number];

export type SceneArt = {
  src: string;
  width: number;
  height: number;
  /** Point (0..1) kept on screen when the art is cropped. */
  focus: readonly [number, number];
  /** Water areas that sparkle (polygons). */
  water?: readonly (readonly Pt[])[];
  /** Tabi's feet (bottom-centre) and width, in % of the art. */
  tabi?: { x: number; y: number; w: number };
  /** Band the birds fly across: x, y, width, height. */
  sky?: readonly [number, number, number, number];
  steam?: readonly Pt[];
  lanterns?: readonly Pt[];
};

export type SceneParticles = "petal" | "maple" | "snow";

export type Scene = {
  id: string;
  nameJa: string;
  /** Text colour that reads over the calm part of the art (light mode). */
  ink: "dark" | "light";
  seasons: readonly Season[];
  birds?: number;
  particles?: SceneParticles;
  /** Tabi sprite for this scene. */
  tabiSrc: string;
  wide: SceneArt;
  /** Portrait plate for phones; without it the wide art is cropped. */
  tall?: SceneArt;
  /** Focus used when cropping the wide art to portrait. */
  tallFocus?: readonly [number, number];
};

export const SCENES: readonly Scene[] = [
  {
    // Placeholder until the painted plates arrive: the current backdrop.
    id: "coast-line",
    nameJa: "海沿いの線路",
    ink: "dark",
    seasons: ["spring", "summer", "autumn", "winter"],
    birds: 3,
    particles: "petal",
    tabiSrc: "/mascot/walking.png",
    wide: {
      src: "/travel-backdrop.jpg",
      width: 1693,
      height: 929,
      focus: [0.62, 0.55],
      water: [
        [
          [35, 52], [44, 51.5], [52, 53.5], [60, 56], [62, 60], [57, 62.5],
          [55, 64], [60, 66], [63, 70], [62, 75], [57, 79], [49, 80],
          [44, 76], [41, 68], [38, 59],
        ],
      ],
      tabi: { x: 52, y: 97, w: 10 },
      sky: [4, 6, 70, 30],
    },
    tallFocus: [0.6, 0.5],
  },
];

const SCENE_KEY = "tabi-compass:scene";

// Seasonal scenes are three times as likely in their season.
function pickScene(exclude?: string): Scene {
  const season = seasonForDate(new Date());
  const pool = SCENES.filter((scene) => scene.id !== exclude);
  const list = pool.length ? pool : SCENES;
  const weights = list.map((scene) => (scene.seasons.includes(season) ? 3 : 1));
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return list[i];
  }
  return list[list.length - 1];
}

// One scene per browser session (so going back doesn't reshuffle it); a new
// visit gets a new one.
export function sessionScene(): Scene {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(SCENE_KEY);
  } catch {
    // storage blocked
  }
  const scene = SCENES.find((item) => item.id === stored) ?? pickScene();
  try {
    sessionStorage.setItem(SCENE_KEY, scene.id);
  } catch {
    // ignore
  }
  return scene;
}

export function nextScene(current: Scene): Scene {
  const scene = pickScene(current.id);
  try {
    sessionStorage.setItem(SCENE_KEY, scene.id);
  } catch {
    // ignore
  }
  return scene;
}
