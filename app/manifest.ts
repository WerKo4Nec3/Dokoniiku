import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "旅コンパス / Tabi Compass",
    short_name: "旅コンパス",
    description: "旅の精タビが、次の週末の行き先を選ぶ旅アプリ。",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ed",
    theme_color: "#285f4d",
    lang: "ja",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
