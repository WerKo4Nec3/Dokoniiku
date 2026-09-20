import Link from "next/link";
import type { Metadata } from "next";
import { decodeTrip } from "@/lib/tripShare";
import { categoryLabels, formatYen } from "@/lib/utils/travel";
import type { DestinationCategory } from "@/types";

type SP = Promise<{ [key: string]: string | string[] | undefined }>;

function paramD(sp: { [key: string]: string | string[] | undefined }): string {
  const d = sp.d;
  return typeof d === "string" ? d : "";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SP;
}): Promise<Metadata> {
  const d = paramD(await searchParams);
  const trip = decodeTrip(d);
  const title = trip ? `${trip.n}｜旅コンパス` : "旅コンパス";
  const description = trip
    ? `${trip.p} ・ 約${trip.km}km の週末旅。タビが選んだ次の行き先。`
    : "旅の精タビが、次の週末の行き先を選ぶ日本の小さな旅アプリ。";
  const ogImage = `/api/og?d=${encodeURIComponent(d)}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function TripPage({ searchParams }: { searchParams: SP }) {
  const trip = decodeTrip(paramD(await searchParams));

  if (!trip) {
    return (
      <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-lg px-4 pb-20 pt-32 text-center sm:px-6">
        <p className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-sm font-medium text-[color:var(--muted)]">
          旅リンクが読み込めませんでした。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-vermilion px-6 py-3 text-sm font-black text-white transition hover:opacity-90"
        >
          旅コンパスをはじめる
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-2xl px-4 pb-20 pt-28 sm:px-6">
      <p className="text-sm font-bold text-vermilion">
        TABI&apos;S PICK / 週末の行き先
      </p>
      <h1 className="mt-2 font-display text-4xl font-black sm:text-5xl">
        {trip.n}
      </h1>
      <p className="mt-2 text-sm font-bold text-[color:var(--muted)]">
        📍 {trip.p} ・ 約{trip.km}km
      </p>

      {trip.img && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--line)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trip.img}
            alt={trip.n}
            className="h-64 w-full object-cover sm:h-80"
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {trip.t != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky/15 px-3 py-1.5 text-xs font-bold text-[#3f8ea0] dark:text-sky">
            🌤 {trip.t}℃{trip.w ? ` ・ ${trip.w}` : ""}
          </span>
        )}
        {trip.y > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-vermilion/10 px-3 py-1.5 text-xs font-bold text-vermilion">
            💴 予算 {formatYen(trip.y)}
          </span>
        )}
        {trip.c.map((c) => (
          <span
            key={c}
            className="rounded-full bg-forest/10 px-3 py-1.5 text-xs font-bold text-forest dark:bg-[#8fd0b9]/10 dark:text-[#8fd0b9]"
          >
            {categoryLabels[c as DestinationCategory] ?? c}
          </span>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-center">
        <p className="text-sm font-bold">あなたの週末は、どこへ？</p>
        <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
          方角を選ぶと、タビが行き先をランダムに選んでくれます。
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-vermilion px-6 py-3 text-sm font-black text-white shadow-sm shadow-vermilion/30 transition hover:opacity-90"
        >
          自分の旅を見つける
        </Link>
      </div>
    </section>
  );
}
