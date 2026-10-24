"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { BASEMAP_ATTRIBUTION, JAPAN_CENTER, accentColor, basemapUrl } from "@/features/journey/mapTheme";
import type { LiveLocation } from "@/types";

export type LivePoint = Pick<LiveLocation, "uid" | "name" | "avatarEmoji" | "avatarColor" | "lat" | "lon"> & {
  me?: boolean;
  label?: string;
};

function avatarIcon(point: LivePoint, accent: string) {
  const bg = point.avatarColor ?? (point.me ? accent : "#5b6570");
  const ring = point.me ? accent : "#ffffff";
  return L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="position:relative;width:44px;height:44px">
      <span style="position:absolute;inset:0;border-radius:9999px;background:${ring};opacity:.35;animation:reveal-pulse 2s ease-out infinite"></span>
      <span style="position:absolute;inset:5px;display:grid;place-items:center;border-radius:9999px;background:${bg};border:3px solid ${ring};font-size:18px;box-shadow:0 4px 10px rgba(0,0,0,.3)">${point.avatarEmoji ?? "🧳"}</span>
    </div>`,
  });
}

// Fit everyone in view once, then fly to whoever is focused.
function Camera({ points, focus }: { points: LivePoint[]; focus: string | null }) {
  const map = useMap();
  const key = points.map((p) => p.uid).join(",");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView([points[0].lat, points[0].lon], 14);
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])), { padding: [48, 48], maxZoom: 15 });
    // Only when who's on the map changes, not on every position update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  useEffect(() => {
    const target = points.find((p) => p.uid === focus);
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 14), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, map]);
  return null;
}

export default function LiveMap({ points, focus }: { points: LivePoint[]; focus: string | null }) {
  const [accent] = useState(accentColor);
  const icons = useMemo(() => new Map(points.map((p) => [p.uid, avatarIcon(p, accent)])), [points, accent]);
  return (
    <MapContainer
      center={JAPAN_CENTER}
      zoom={5}
      minZoom={4}
      maxZoom={18}
      className="h-full w-full"
      style={{ background: "var(--surface)" }}
    >
      <TileLayer attribution={BASEMAP_ATTRIBUTION} url={basemapUrl()} />
      {points.map((point) => (
        <Marker key={point.uid} position={[point.lat, point.lon]} icon={icons.get(point.uid)}>
          <Tooltip direction="top" offset={[0, -20]}>
            {point.me ? "あなた" : point.name}
            {point.label ? `・${point.label}` : ""}
          </Tooltip>
        </Marker>
      ))}
      <Camera points={points} focus={focus} />
    </MapContainer>
  );
}
