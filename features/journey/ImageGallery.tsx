"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizePhotoUrl } from "@/lib/photos";

// A hero image with a thumbnail strip underneath. Tapping a thumbnail swaps
// the large image. Every photo is pre-checked: ones that fail to load (dead
// link, hotlink block, rejected thumbnail size…) are dropped instead of
// showing up as black tiles. Falls back to the brand backdrop when none work.
export function ImageGallery({
  images,
  alt,
  className = "",
  frameClass = "",
}: {
  images: string[];
  alt: string;
  className?: string;
  frameClass?: string;
}) {
  const sources = useMemo(
    () => [...new Set(images.map((u) => normalizePhotoUrl(u)).filter(Boolean))],
    [images],
  );
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [activeSrc, setActiveSrc] = useState<string | null>(null);

  // New place → forget old failures/selection and probe the new set.
  useEffect(() => {
    setFailed(new Set());
    setActiveSrc(null);
    let alive = true;
    const probes = sources.map((src) => {
      const img = new Image();
      img.referrerPolicy = "no-referrer-when-downgrade";
      img.onerror = () => {
        if (!alive) return;
        setFailed((prev) => {
          if (prev.has(src)) return prev;
          const next = new Set(prev);
          next.add(src);
          return next;
        });
      };
      img.src = src;
      return img;
    });
    return () => {
      alive = false;
      probes.forEach((img) => {
        img.onerror = null;
      });
    };
  }, [sources]);

  const usable = sources.filter((src) => !failed.has(src));
  const gallery = usable.length ? usable : ["/travel-backdrop.jpg"];
  const current =
    activeSrc && gallery.includes(activeSrc) ? activeSrc : gallery[0];

  return (
    <div className={className}>
      <div
        className={`relative h-60 overflow-hidden rounded-lg sm:h-80 ${frameClass}`}
      >
        <div
          key={current}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-300"
          style={{ backgroundImage: `url('${current}')` }}
          role="img"
          aria-label={alt}
        />
      </div>

      {gallery.length > 1 && (
        <div className="no-scrollbar mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
          {gallery.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setActiveSrc(src)}
              aria-label={`${alt} 写真 ${index + 1}`}
              aria-current={src === current}
              className={`h-14 w-20 shrink-0 snap-start overflow-hidden rounded-md border-2 bg-[color:var(--surface-muted)] bg-cover bg-center transition ${
                src === current
                  ? "border-vermilion opacity-100"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
              style={{ backgroundImage: `url('${src}')` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
