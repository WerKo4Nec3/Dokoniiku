"use client";

import { useEffect, useState } from "react";

// A hero image with a thumbnail strip underneath. Tapping a thumbnail swaps
// the large image. Falls back to the brand backdrop when there are no photos.
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
  const gallery = images.length ? images : ["/travel-backdrop.jpg"];
  const [active, setActive] = useState(0);

  // Reset to the first photo whenever the place (its image set) changes.
  useEffect(() => {
    setActive(0);
  }, [images]);

  const current = gallery[Math.min(active, gallery.length - 1)];

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
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {gallery.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${alt} 写真 ${index + 1}`}
              aria-current={index === active}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 bg-cover bg-center transition ${
                index === active
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
