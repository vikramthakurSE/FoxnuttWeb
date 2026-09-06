"use client";

import Link from "next/link";
import { useState } from "react";
import type { SfProduct } from "@/lib/salesforce";
import { formatINR } from "@/lib/format";
import { useCart } from "./CartProvider";
import ProductImage from "./ProductImage";

export default function ProductCard({ product }: { product: SfProduct }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const out = !product.inStock;

  return (
    <div className="group rounded-2xl bg-card shadow-card border border-line overflow-hidden flex flex-col">
      <Link href={`/products/${product.slug}`} className="block">
        <ProductImage
          slug={product.slug}
          name={product.name}
          packLabel={product.packLabel}
          className="aspect-[4/3]"
        />
      </Link>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/products/${product.slug}`}
            className="font-display font-bold leading-snug hover:text-terra"
          >
            {product.name}
          </Link>
          {product.badge && (
            <span className="shrink-0 rounded-full bg-gold/15 text-gold text-[11px] font-semibold px-2 py-0.5 uppercase tracking-wide">
              {product.badge}
            </span>
          )}
        </div>
        {product.grade && (
          <p className="text-xs text-ink-soft">{product.grade}</p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <div>
            <p className="font-bold text-lg leading-none">
              {formatINR(product.pricePerPacket)}
            </p>
            <p className="text-[11px] text-ink-soft mt-0.5">
              per {product.packLabel ?? "pack"}
            </p>
          </div>
          <button
            type="button"
            disabled={out}
            onClick={() => {
              add(product.slug, product.minOrderPackets || 1);
              setAdded(true);
              setTimeout(() => setAdded(false), 1200);
            }}
            className={`rounded-full px-4 h-10 text-sm font-semibold transition-colors ${
              out
                ? "bg-cream-2 text-ink-soft cursor-not-allowed"
                : added
                  ? "bg-leaf text-cream"
                  : "bg-terra text-cream hover:bg-terra-dark"
            }`}
          >
            {out ? "Out of stock" : added ? "Added ✓" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
