import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "Hiragino Sans", "system-ui", "sans-serif"],
        display: [
          "var(--font-display)",
          "Hiragino Maru Gothic ProN",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        ink: "#1e1b15",
        paper: "#f7f3ed",
        // Accent colours come from CSS variables so the settings page can
        // swap palettes at runtime (see globals.css [data-palette=…]).
        vermilion: "rgb(var(--c-vermilion) / <alpha-value>)",
        forest: "rgb(var(--c-forest) / <alpha-value>)",
        // Text-safe forest: equals forest in light mode, a light tint in dark
        // mode (per palette) — use instead of hard-coded mint.
        "forest-ink": "rgb(var(--c-forest-ink) / <alpha-value>)",
        sky: "#75b9c8",
        sun: "#f2c14e",
      },
      boxShadow: {
        float: "0 18px 60px var(--shadow-float)",
      },
    },
  },
  plugins: [],
};

export default config;
