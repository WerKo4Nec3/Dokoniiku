"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

// Interactive OpenStreetMap tile map. Unlike the static export embed, this
// gives working zoom-in AND zoom-out plus panning. A CircleMarker is used
// instead of the default pin so we don't have to ship Leaflet's marker image
// assets (which break under the bundler).
export default function PlaceMap({
  latitude,
  longitude,
  name,
}: {
  latitude: number;
  longitude: number;
  name: string;
}) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={14}
      minZoom={4}
      maxZoom={18}
      scrollWheelZoom={false}
      className="h-60 w-full"
      style={{ background: "var(--surface)" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[latitude, longitude]}
        radius={9}
        pathOptions={{
          color: "#ffffff",
          weight: 2,
          fillColor: "#e14b32",
          fillOpacity: 1,
        }}
      >
        <Tooltip direction="top" offset={[0, -6]}>
          {name}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
