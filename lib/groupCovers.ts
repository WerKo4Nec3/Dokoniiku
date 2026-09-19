import type { GroupCover } from "@/types";

// Keyless preset gradient banners for groups. Covers are decorative art (fixed
// hexes on purpose), so they read the same regardless of the active accent
// palette; the emoji chip below a cover still uses palette tokens.
export const GROUP_COVERS: Record<GroupCover, { label: string; css: string }> = {
  sunset: {
    label: "夕焼け",
    css: "linear-gradient(135deg,#ff9a56 0%,#ff6f91 55%,#c44569 100%)",
  },
  forest: {
    label: "森",
    css: "linear-gradient(135deg,#3aa17e 0%,#2f6d5b 60%,#1f4d3f 100%)",
  },
  ocean: {
    label: "海",
    css: "linear-gradient(135deg,#5ec5d6 0%,#3f8fbf 55%,#2f5f9e 100%)",
  },
  sakura: {
    label: "桜",
    css: "linear-gradient(135deg,#f7b6c9 0%,#e97ba6 55%,#c25d8a 100%)",
  },
  night: {
    label: "夜",
    css: "linear-gradient(135deg,#5b6ee1 0%,#3d4a7a 55%,#232a52 100%)",
  },
  citrus: {
    label: "柑橘",
    css: "linear-gradient(135deg,#f9d976 0%,#f2c14e 50%,#e0932f 100%)",
  },
};

export const DEFAULT_COVER: GroupCover = "forest";
export const coverCss = (cover?: GroupCover) =>
  GROUP_COVERS[cover ?? DEFAULT_COVER].css;
