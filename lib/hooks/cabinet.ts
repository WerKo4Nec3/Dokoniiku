"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchUserJourneys } from "@/lib/api/savedJourneys";
import type { JourneyResult, SavedJourney } from "@/types";

// Shared data loading for every cabinet page (/saved, /calendar, /friends,
// /profile): the signed-in user plus their saved journeys.
export function useUserJourneys() {
  const { enabled, loading, user } = useAuth();
  // null = not loaded yet.
  const [journeys, setJourneys] = useState<SavedJourney[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchUserJourneys(user.uid)
      .then((items) => {
        if (active) setJourneys(items);
      })
      .catch(() => {
        if (active) setJourneys([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return { enabled, loading, user, journeys, setJourneys };
}

// Open a journey as the full result view on the home page.
export function useOpenJourney() {
  const router = useRouter();
  return useCallback(
    (journey: JourneyResult) => {
      try {
        sessionStorage.setItem(
          "dokoniiku:view-journey",
          JSON.stringify(journey),
        );
      } catch {
        return;
      }
      router.push("/");
    },
    [router],
  );
}
