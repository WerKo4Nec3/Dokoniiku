import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dokoniiku / 旅コンパス",
    short_name: "Dokoniiku",
    description: "旅の精タビが、次の週末の行き先を選ぶ旅アプリ。",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ed",
    theme_color: "#285f4d",
    lang: "ja",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
