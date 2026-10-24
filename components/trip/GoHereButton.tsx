"use client";

import { motion } from "framer-motion";
import { ArrowRight, Footprints } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { startTrip, useActiveTrip } from "@/lib/trips";
import type { JourneyResult } from "@/types";

// "ここに行く！" — accept Tabi's pick. The trip then stays open (bottom bar)
// until the traveller arrives and writes a record.
export function GoHereButton({
  journey,
  onStarted,
}: {
  journey: JourneyResult;
  onStarted?: () => void;
}) {
  const trip = useActiveTrip();
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const current = trip?.journey.destination.id === journey.destination.id;

  if (current) {
    return (
      <Link
        href="/travel"
        className="inline-flex items-center gap-2 rounded-full bg-vermilion/10 px-5 py-3.5 text-sm font-bold text-vermilion transition hover:bg-vermilion/15"
      >
        <Footprints size={17} />
        {trip?.arrivedAt ? "散策中・旅のページへ" : "旅の途中・旅のページへ"}
      </Link>
    );
  }

  async function go() {
    setBusy(true);
    await startTrip(journey, user?.uid);
    setBusy(false);
    onStarted?.();
    router.push("/travel");
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5 lg:items-end">
      <motion.button
        type="button"
        onClick={() => void go()}
        disabled={busy}
        whileTap={{ scale: 0.97 }}
        className="scene-cta group justify-center"
      >
        ここに行く！
        <ArrowRight size={17} className="transition group-hover:translate-x-1" />
      </motion.button>
      <p className="text-center text-[11px] font-medium text-[color:var(--muted)] lg:text-right">
        {trip
          ? `いまの旅（${trip.journey.destination.name}）は終わりにして切り替えます`
          : "旅のページで、天気・道順・現地の情報をナビするよ"}
      </p>
    </div>
  );
}
