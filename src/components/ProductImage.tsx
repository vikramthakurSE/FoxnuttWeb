"use client";

import { useState } from "react";
import { brandTheme } from "@/lib/brand";

/**
 * Shows public/products/<slug>.jpg when you drop a real photo there;
 * otherwise renders a branded tile in the product line's colours.
 */
export default function ProductImage({
  slug,
  name,
  packLabel,
  className = "",
}: {
  slug: string;
  name: string;
  packLabel?: string | null;
  className?: string;
}) {
  const [photoOk, setPhotoOk] = useState(true);
  const theme = brandTheme(slug);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {photoOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/products/${slug}.jpg`}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setPhotoOk(false)}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3 text-center"
          style={{
            background: `linear-gradient(150deg, ${theme.from}, ${theme.to})`,
          }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{ background: theme.accent }}
            aria-hidden
          >
            🪷
          </div>
          <p
            className="font-display text-lg font-bold leading-tight"
            style={{ color: theme.accent }}
          >
            {theme.short}
          </p>
          {packLabel && (
            <p className="text-xs" style={{ color: theme.accent, opacity: 0.85 }}>
              {packLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
