import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2924",
        paper: "#f7f4ed",
        // Accent colours come from CSS variables so the settings page can
        // swap palettes at runtime (see globals.css [data-palette=…]).
        vermilion: "rgb(var(--c-vermilion) / <alpha-value>)",
        forest: "rgb(var(--c-forest) / <alpha-value>)",
        sky: "#75b9c8",
        sun: "#f2c14e",
      },
      boxShadow: {
        float: "0 18px 60px rgba(31, 41, 36, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
