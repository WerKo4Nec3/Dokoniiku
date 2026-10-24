"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isOSPath } from "@/components/tabi-os/apps";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchActiveTrip, saveActiveTrip } from "@/lib/api/trips";
import { storeActiveTrip } from "@/lib/storage/activeTrip";
import { readActiveTrip, useActiveTrip } from "@/lib/trips";
import { displayPlaceName } from "@/lib/utils/travel";

// Keeps the local trip and the account copy in step: on sign-in the newer
// one wins, afterwards every local change is pushed up.
function useTripSync() {
  const { user } = useAuth();
  const trip = useActiveTrip();
  const pushed = useRef<string | null>(null);
  const [ready, setReady] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchActiveTrip(user.uid)
      .then((cloud) => {
        if (!active) return;
        const local = readActiveTrip();
        if (cloud && (!local || cloud.startedAt > local.startedAt)) {
          pushed.current = JSON.stringify(cloud);
          storeActiveTrip(cloud);
        } else {
          pushed.current = JSON.stringify(cloud);
        }
        setReady(user.uid);
      })
      .catch(() => setReady(user.uid));
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || ready !== user.uid) return;
    const json = JSON.stringify(trip);
    if (json === pushed.current) return;
    pushed.current = json;
    void saveActiveTrip(user.uid, trip).catch(() => {});
  }, [trip, user, ready]);
}

// The open trip, pinned on every page (a "live activity" in the tablet's
// status bar, a pill at the bottom elsewhere). Tapping it opens 旅の途中.
export function ActiveTripBar() {
  useTripSync();
  const trip = useActiveTrip();
  const pathname = usePathname();
  const visible = Boolean(trip) && !pathname.startsWith("/admin") && pathname !== "/travel";

  useEffect(() => {
    const root = document.documentElement;
    if (visible) root.dataset.trip = "on";
    else delete root.dataset.trip;
    return () => {
      delete root.dataset.trip;
    };
  }, [visible]);

  if (!trip || !visible) return null;
  const compact = isOSPath(pathname);
  const status = trip.finishedAt ? "記録しよう" : trip.arrivedAt ? "散策中" : "旅の途中";
  const name = displayPlaceName(trip.journey.destination.name);

  return (
    <div className="trip-bar pointer-events-none fixed inset-x-0 z-[1200] flex justify-center px-3">
      <motion.div
        initial={{ y: compact ? -16 : 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className={`scene-glass pointer-events-auto w-full overflow-hidden ${
          compact ? "max-w-[min(15rem,46vw)] rounded-full" : "max-w-md rounded-[26px]"
        }`}
      >
        <Link
          href="/travel"
          className={`flex w-full items-center text-left ${compact ? "gap-2 px-1.5 py-1" : "gap-3 px-3 py-2.5"}`}
        >
          <span
            className={`relative grid shrink-0 place-items-center overflow-hidden bg-forest/15 ${
              compact ? "h-6 w-6 rounded-full" : "h-10 w-10 rounded-2xl"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trip.journey.destination.imageUrl ?? "/mascot/walking.png"}
              alt=""
              className="h-full w-full object-cover"
            />
            {!trip.arrivedAt && (
              <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-vermilion" />
            )}
          </span>
          {compact ? (
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[color:var(--foreground)]">
              <span className="text-vermilion">{status}</span>・{name}
            </span>
          ) : (
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold tracking-[0.2em] text-vermilion">{status}</span>
              <span className="block truncate text-sm font-bold text-[color:var(--foreground)]">
                {name}
                <span className="ml-1.5 text-xs font-medium text-[color:var(--muted)]">
                  {trip.journey.prefecture.nameJa}
                </span>
              </span>
            </span>
          )}
          <ChevronRight size={compact ? 14 : 18} className="shrink-0 text-[color:var(--muted)]" />
        </Link>
      </motion.div>
    </div>
  );
}
