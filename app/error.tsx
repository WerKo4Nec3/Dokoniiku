"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { reloadOnce } from "@/lib/recover";

// Any page that throws lands here (inside the normal layout). First try a
// silent reload — almost always a stale build after a deploy.
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const [reloading, setReloading] = useState(true);

  useEffect(() => {
    console.error(error);
    if (!reloadOnce()) {
      const timer = window.setTimeout(() => setReloading(false), 0);
      return () => window.clearTimeout(timer);
    }
  }, [error]);

  if (reloading) {
    return <div className="min-h-[calc(100vh-4rem)]" aria-busy="true" />;
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-6 pb-16 pt-24 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mascot/map.png" alt="" className="w-40" />
      <h1 className="mt-4 font-display text-2xl font-bold">ページを読み込めませんでした</h1>
      <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
        サイトが更新されたばかりかもしれません。再読み込みすると直ることが多いよ。
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => window.location.reload()} className="scene-cta justify-center">
          <RotateCcw size={16} /> 再読み込み
        </button>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-bold"
        >
          もう一度試す
        </button>
        <Link href="/" className="rounded-full px-5 py-3 text-sm font-bold text-[color:var(--muted)]">
          ホームへ
        </Link>
      </div>
    </section>
  );
}
