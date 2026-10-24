"use client";

import { CabinetHeader } from "@/components/CabinetHeader";
import { QuestBoard } from "@/components/events/QuestBoard";
import { openAuthDialog } from "@/components/AuthDialog";
import { useUserJourneys } from "@/lib/hooks/cabinet";

export default function EventsPage() {
  const { enabled, user, journeys } = useUserJourneys();
  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader
        eyebrow="季節のクエスト"
        title="クエスト掲示板"
        subtitle="季節ごとの依頼を受けて、名所をめぐろう。達成するとXPと、タビの限定きせかえがもらえるよ。"
        mascot="map"
        accent="sun"
      />
      {enabled && !user && (
        <button
          type="button"
          onClick={openAuthDialog}
          className="mt-4 w-full rounded-2xl border border-dashed border-[color:var(--line)] px-4 py-3 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
        >
          ログインすると、クエストの達成状況が記録されます
        </button>
      )}
      <QuestBoard journeys={journeys} />
    </section>
  );
}
