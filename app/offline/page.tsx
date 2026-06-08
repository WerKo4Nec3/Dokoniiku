import { Compass, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <section className="grid min-h-[calc(100vh-4rem)] place-items-center px-5 py-24 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-forest text-white">
          <Compass size={34} />
        </span>
        <h1 className="mt-7 text-3xl font-black">いまは電波が届かないようです</h1>
        <p className="mt-4 leading-7 text-[color:var(--muted)]">
          保存済みの旅は端末に残っています。接続が戻ったら、タビと新しい目的地を探しましょう。
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-vermilion px-5 text-sm font-bold text-white"
        >
          <RotateCcw size={17} />
          もう一度試す
        </Link>
      </div>
    </section>
  );
}
