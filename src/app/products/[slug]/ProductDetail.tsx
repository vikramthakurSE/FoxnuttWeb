"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SfProduct } from "@/lib/salesforce";
import { formatINR, formatKg } from "@/lib/format";
import { useCart } from "@/components/CartProvider";
import ProductImage from "@/components/ProductImage";
import QtyStepper from "@/components/QtyStepper";

export default function ProductDetail({
  product,
  live,
}: {
  product: SfProduct;
  live: boolean;
}) {
  const { add } = useCart();
  const router = useRouter();
  const min = product.minOrderPackets || 1;
  const [qty, setQty] = useState(min);
  const [added, setAdded] = useState(false);

  const out = !product.inStock;
  const lowStock =
    product.inStock && product.availablePackets <= Math.max(5, min);
  const kgForQty = (qty * product.packSizeGrams) / 1000;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/products"
        className="text-sm text-ink-soft hover:text-ink"
      >
        ← All products
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <ProductImage
          slug={product.slug}
          name={product.name}
          packLabel={product.packLabel}
          className="aspect-[4/3] rounded-2xl shadow-card"
        />

        <div>
          {product.badge && (
            <span className="rounded-full bg-gold/15 text-gold text-xs font-semibold px-2.5 py-1 uppercase tracking-wide">
              {product.badge}
            </span>
          )}
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight">
            {product.name}
          </h1>
          {product.grade && (
            <p className="mt-1 text-ink-soft">{product.grade}</p>
          )}

          <p className="mt-4 text-3xl font-bold">
            {formatINR(product.pricePerPacket)}
            <span className="ml-2 text-sm font-normal text-ink-soft">
              per {product.packLabel ?? "pack"} ·{" "}
              {formatINR(product.pricePerKg)}/kg
            </span>
          </p>

          <div className="mt-2 text-sm">
            {out ? (
              <span className="font-semibold text-terra">
                Out of stock — check back soon
              </span>
            ) : lowStock ? (
              <span className="font-semibold text-terra">
                Only {product.availablePackets} left in stock
              </span>
            ) : (
              <span className="font-semibold text-leaf">In stock</span>
            )}
          </div>

          {product.description && (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {product.description}
            </p>
          )}

          <ul className="mt-4 space-y-1 text-sm text-ink-soft">
            <li>• Process: hand-picked, sun-dried, plain (unroasted)</li>
            <li>• Shelf life: 12 months</li>
            {product.packLabel && <li>• Pack: {product.packLabel}</li>}
          </ul>

          {!out && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <QtyStepper
                value={qty}
                min={min}
                max={product.availablePackets}
                onChange={setQty}
              />
              <span className="text-sm text-ink-soft">
                = {formatKg(kgForQty)} ·{" "}
                {formatINR(product.pricePerKg * kgForQty)}
              </span>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={out || !live}
              onClick={() => {
                add(product.slug, qty);
                setAdded(true);
                setTimeout(() => setAdded(false), 1500);
              }}
              className={`rounded-full px-7 h-12 font-semibold transition-colors ${
                out || !live
                  ? "bg-cream-2 text-ink-soft cursor-not-allowed"
                  : added
                    ? "bg-leaf text-cream"
                    : "bg-terra text-cream hover:bg-terra-dark"
              }`}
            >
              {added ? "Added to cart ✓" : "Add to cart"}
            </button>
            <button
              type="button"
              disabled={out || !live}
              onClick={() => {
                add(product.slug, qty);
                router.push("/checkout");
              }}
              className="rounded-full border border-ink/20 px-7 h-12 font-semibold hover:bg-cream-2 transition-colors disabled:opacity-40"
            >
              Buy now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
