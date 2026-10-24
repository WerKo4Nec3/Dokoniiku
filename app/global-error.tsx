"use client";

import { useEffect, useState } from "react";
import { reloadOnce } from "@/lib/recover";

// Last resort when the root layout itself fails. It replaces the layout, so
// it carries its own minimal styling.
export default function GlobalError({
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

  const button = {
    border: "none",
    borderRadius: 9999,
    padding: "12px 22px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  } as const;

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#151210",
          color: "#f4efe8",
          fontFamily: '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif',
        }}
      >
        <title>Dokoniiku</title>
        {!reloading && (
          <main style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot/map.png" alt="" style={{ width: 150 }} />
            <h1 style={{ fontSize: 22, margin: "16px 0 8px" }}>ページを読み込めませんでした</h1>
            <p style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.75, margin: 0 }}>
              サイトが更新されたばかりかもしれません。再読み込みすると直ることが多いよ。
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ ...button, background: "#d14229", color: "#fff" }}
              >
                再読み込み
              </button>
              <button
                type="button"
                onClick={() => unstable_retry()}
                style={{ ...button, background: "transparent", color: "#f4efe8", border: "1px solid #4a423b" }}
              >
                もう一度試す
              </button>
            </div>
          </main>
        )}
      </body>
    </html>
  );
}
