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
        vermilion: "#e8583e",
        forest: "#285f4d",
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
