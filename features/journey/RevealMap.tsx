"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

// Loading-stage reveal: the whole of Japan, then a cinematic flyTo onto the
// place the randomizer just picked, landing with a pulsing pin + its name.
// Non-interactive on purpose — it's a moment, not a tool.

export const JAPAN_CENTER: [number, number] = [36.6, 137.8];
const JAPAN_ZOOM = 5;

// Keyless OSM tiles (CARTO now needs an API key). Dark mode darkens them with
// a CSS filter on the tile pane (see globals.css), so one URL serves both.
export function basemapUrl() {
  return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
}
// The palette accent as a literal colour (SVG attributes can't resolve var()).
export function accentColor(): string {
  if (typeof document === "undefined") return "#e8583e";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--c-vermilion")
    .trim();
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  return parts.length === 3 ? `rgb(${parts.join(",")})` : "#e8583e";
}

export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function Flight({
  lat,
  lon,
  onArrive,
}: {
  lat: number;
  lon: number;
  onArrive: () => void;
}) {
  const map = useMap();
  const arrive = useRef(onArrive);
  useEffect(() => {
    arrive.current = onArrive;
  });
  useEffect(() => {
    const done = () => arrive.current();
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      map.setView([lat, lon], 11, { animate: false });
      done();
      return;
    }
    const start = window.setTimeout(() => {
      map.once("moveend", done);
      map.flyTo([lat, lon], 11, { duration: 2.4, easeLinearity: 0.2 });
    }, 450);
    return () => {
      window.clearTimeout(start);
      map.off("moveend", done);
    };
  }, [map, lat, lon]);
  return null;
}

export default function RevealMap({
  latitude,
  longitude,
  name,
  onLanded,
}: {
  latitude: number;
  longitude: number;
  name: string;
  onLanded?: () => void;
}) {
  const [arrived, setArrived] = useState(false);
  const [url] = useState(basemapUrl);
  const [accent] = useState(accentColor);

  return (
    <MapContainer
      center={JAPAN_CENTER}
      zoom={JAPAN_ZOOM}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      keyboard={false}
      attributionControl
      className="h-full w-full"
      style={{ background: "var(--surface-muted)" }}
    >
      <TileLayer attribution={BASEMAP_ATTRIBUTION} url={url} />
      <Flight
        lat={latitude}
        lon={longitude}
        onArrive={() => {
          setArrived(true);
          onLanded?.();
        }}
      />
      {arrived && (
        <>
          <CircleMarker
            center={[latitude, longitude]}
            radius={22}
            pathOptions={{
              color: accent,
              weight: 2,
              fillColor: accent,
              fillOpacity: 0.18,
              className: "reveal-pulse",
            }}
          />
          <CircleMarker
            center={[latitude, longitude]}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: accent,
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} permanent className="reveal-tip">
              {name}
            </Tooltip>
          </CircleMarker>
        </>
      )}
    </MapContainer>
  );
}
