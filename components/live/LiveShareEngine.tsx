"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { clearLiveLocation, writeLiveLocation } from "@/lib/api/liveLocation";
import { fetchProfile } from "@/lib/api/profile";
import { stopLiveShare, useLiveShare } from "@/lib/live";
import { useActiveTrip } from "@/lib/trips";
import { preciseDistanceKm } from "@/lib/utils/travel";
import type { TabibitoProfile } from "@/types";

// Writes the traveller's position while a sharing session is on (mounted
// once in the layout so it keeps running across pages). Throttled to one
// write per ~20s or 40m of movement, plus a heartbeat every minute.
export function LiveShareEngine() {
  const session = useLiveShare();
  const { user } = useAuth();
  const trip = useActiveTrip();
  const heading = trip?.journey.destination.name;
  const profile = useRef<TabibitoProfile | null>(null);
  const last = useRef<{ t: number; lat: number; lon: number; accuracy: number } | null>(null);
  const hadSession = useRef(false);

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.uid)
      .then((value) => {
        profile.current = value;
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!session || !user) return;
    hadSession.current = true;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      stopLiveShare();
      return;
    }
    const write = (lat: number, lon: number, accuracy: number) => {
      last.current = { t: Date.now(), lat, lon, accuracy };
      void writeLiveLocation(user.uid, {
        profile: profile.current,
        fallbackName: user.displayName || "旅人",
        viewers: session.viewers,
        expiresAt: session.expiresAt,
        lat,
        lon,
        accuracy,
        heading,
      }).catch(() => {});
    };

    const expiry = window.setTimeout(stopLiveShare, remaining);
    const heartbeat = window.setInterval(() => {
      const prev = last.current;
      if (prev && Date.now() - prev.t > 55000) write(prev.lat, prev.lon, prev.accuracy);
    }, 60000);
    let watchId: number | null = null;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const prev = last.current;
          const now = Date.now();
          if (prev) {
            const movedM =
              preciseDistanceKm(
                { latitude: prev.lat, longitude: prev.lon },
                { latitude, longitude },
              ) * 1000;
            if (now - prev.t < 8000) return;
            if (now - prev.t < 20000 && movedM < 40) return;
          }
          write(latitude, longitude, accuracy);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
      );
    }
    return () => {
      window.clearTimeout(expiry);
      window.clearInterval(heartbeat);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [session, user, heading]);

  // Sharing stopped (button or expiry): remove the position right away.
  useEffect(() => {
    if (session || !user || !hadSession.current) return;
    hadSession.current = false;
    last.current = null;
    void clearLiveLocation(user.uid).catch(() => {});
  }, [session, user]);

  return null;
}
