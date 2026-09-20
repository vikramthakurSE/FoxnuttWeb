"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { SfProduct } from "@/lib/salesforce";
import { discountPercent, formatINR } from "@/lib/format";
import { dropOntoCard, liftCard, reducedMotion } from "@/lib/productMorph";
import { useCart } from "./CartProvider";
import ProductImage from "./ProductImage";

export default function ProductCard({ product }: { product: SfProduct }) {
  const { add } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const opening = useRef(false);

  const out = !product.inStock;
  const off = discountPercent(
    product.mrpPerPacket ?? 0,
    product.pricePerPacket,
  );
  const href = `/products/${product.slug}`;

  // Back from the product page: open the tile out of its circle.
  useLayoutEffect(() => {
    if (tileRef.current) dropOntoCard(tileRef.current, product.slug);
  }, [product.slug]);

  // Turn the tile into a circle first; the product page grows out of it.
  function open(e: MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    if (!tileRef.current || reducedMotion()) return;
    e.preventDefault();
    if (opening.current) return;
    opening.current = true;
    liftCard(tileRef.current, product.slug).finally(() => router.push(href));
  }

  return (
    <div className="group rounded-2xl bg-card shadow-card border border-line overflow-hidden flex flex-col">
      <Link href={href} onClick={open} className="block">
        <div ref={tileRef}>
          <ProductImage
            slug={product.slug}
            name={product.name}
            packLabel={product.packLabel}
            className="aspect-[4/3]"
          />
        </div>
      </Link>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={href}
            onClick={open}
            className="font-display font-bold leading-snug hover:text-pine"
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
            <div className="flex items-baseline gap-1.5">
              <p className="font-bold text-lg leading-none">
                {formatINR(product.pricePerPacket)}
              </p>
              {off > 0 && (
                <span className="text-xs text-ink-soft line-through">
                  {formatINR(product.mrpPerPacket!)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-ink-soft mt-0.5">
              per {product.packLabel ?? "pack"}
              {off > 0 && (
                <span className="ml-1 font-semibold text-leaf">
                  · {off}% off
                </span>
              )}
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
                ? "bg-mist-2 text-ink-soft cursor-not-allowed"
                : added
                  ? "bg-leaf text-mist"
                  : "bg-pine text-mist hover:bg-pine-dark"
            }`}
          >
            {out ? "Out of stock" : added ? "Added ✓" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
