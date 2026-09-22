"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import {
  BASEMAP_ATTRIBUTION,
  JAPAN_CENTER,
  accentColor,
  basemapUrl,
} from "./RevealMap";

export type ShufflePoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

// Starts on all of Japan, then flies to frame the candidates. Numbered pins
// (DivIcons — no image assets needed) mirror the cards; tapping one picks it.
function FrameCandidates({ points }: { points: ShufflePoint[] }) {
  const map = useMap();
  const key = points.map((p) => p.id).join("|");
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(
      points.map((p) => [p.latitude, p.longitude] as [number, number]),
    );
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => {
      if (reduce) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 11 });
      else
        map.flyToBounds(bounds, {
          padding: [48, 48],
          maxZoom: 11,
          duration: 1.8,
        });
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function ShuffleMap({
  points,
  activeId,
  onPick,
  onHover,
}: {
  points: ShufflePoint[];
  activeId?: string | null;
  onPick: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  const [url] = useState(basemapUrl);
  const [accent] = useState(accentColor);

  const icons = useMemo(
    () =>
      points.map((p, i) =>
        L.divIcon({
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          html: `<span class="shuffle-pin${p.id === activeId ? " is-active" : ""}" style="--pin:${accent}">${i + 1}</span>`,
        }),
      ),
    [points, activeId, accent],
  );

  return (
    <MapContainer
      center={JAPAN_CENTER}
      zoom={5}
      zoomControl={false}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: "var(--surface-muted)" }}
    >
      <TileLayer attribution={BASEMAP_ATTRIBUTION} url={url} />
      <FrameCandidates points={points} />
      {points.map((p, i) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={icons[i]}
          eventHandlers={{
            click: () => onPick(p.id),
            mouseover: () => onHover?.(p.id),
            mouseout: () => onHover?.(null),
          }}
        >
          <Tooltip direction="top" offset={[0, -16]}>
            {p.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
