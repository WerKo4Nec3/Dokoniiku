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

import {
  accentColor,
  BASEMAP_ATTRIBUTION,
  basemapUrl,
  JAPAN_CENTER,
} from "./mapTheme";

const JAPAN_ZOOM = 5;

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
