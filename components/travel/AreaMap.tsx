"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { accentColor } from "@/features/journey/mapTheme";

export type AreaPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  kind: "sight" | "food" | "me";
};

// The area around the destination with a choice of base map: OSM streets,
// GSI terrain (colour relief + hillshade) or GSI aerial photos.
const LAYERS = {
  map: {
    label: "地図",
    tiles: [
      {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxNativeZoom: 19,
        opacity: 1,
      },
    ],
  },
  terrain: {
    label: "地形",
    tiles: [
      {
        url: "https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png",
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
        maxNativeZoom: 15,
        opacity: 1,
      },
      {
        url: "https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png",
        attribution: "",
        maxNativeZoom: 16,
        opacity: 0.45,
      },
    ],
  },
  photo: {
    label: "写真",
    tiles: [
      {
        url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
        maxNativeZoom: 18,
        opacity: 1,
      },
    ],
  },
} as const;
type LayerId = keyof typeof LAYERS;

const KIND_COLOR: Record<AreaPoint["kind"], string> = {
  sight: "#2f7fa5",
  food: "#e8892c",
  me: "#1b9e5a",
};

export default function AreaMap({
  latitude,
  longitude,
  name,
  points,
}: {
  latitude: number;
  longitude: number;
  name: string;
  points: AreaPoint[];
}) {
  const [accent] = useState(accentColor);
  const [layer, setLayer] = useState<LayerId>("map");
  return (
    // Terrain/photo tiles must not get the dark-mode colour inversion.
    <div className={`relative isolate h-full w-full ${layer === "map" ? "" : "area-map-raw"}`}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        minZoom={5}
        maxZoom={18}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ background: "var(--surface)" }}
      >
        {LAYERS[layer].tiles.map((tile) => (
          <TileLayer
            key={tile.url}
            url={tile.url}
            attribution={tile.attribution}
            maxNativeZoom={tile.maxNativeZoom}
            maxZoom={18}
            opacity={tile.opacity}
          />
        ))}
        {points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={point.kind === "me" ? 8 : 6}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: KIND_COLOR[point.kind], fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              {point.kind === "me" ? "あなた" : point.name}
            </Tooltip>
          </CircleMarker>
        ))}
        <CircleMarker
          center={[latitude, longitude]}
          radius={11}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: accent, fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent>
            {name}
          </Tooltip>
        </CircleMarker>
      </MapContainer>
      <div className="absolute right-3 top-3 z-[500] inline-flex rounded-full bg-[color:var(--surface)] p-1 text-xs font-bold shadow-float">
        {(Object.keys(LAYERS) as LayerId[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={layer === id}
            onClick={() => setLayer(id)}
            className={`rounded-full px-3 py-1.5 transition ${
              layer === id ? "bg-vermilion text-white" : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            }`}
          >
            {LAYERS[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}
