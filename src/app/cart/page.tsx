"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SfProduct } from "@/lib/salesforce";
import { formatINR, formatKg } from "@/lib/format";
import { useCart } from "@/components/CartProvider";
import ProductImage from "@/components/ProductImage";
import QtyStepper from "@/components/QtyStepper";

export default function CartPage() {
  const { items, setQty, remove, ready } = useCart();
  const [products, setProducts] = useState<SfProduct[] | null>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => setProducts(d.products as SfProduct[]))
      .catch(() => setProducts([]));
  }, []);

  if (!ready || products === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-ink-soft">
        Loading your cart…
      </div>
    );
  }

  const rows = items
    .map((i) => ({
      item: i,
      product: products.find((p) => p.slug === i.slug),
    }))
    .filter((r): r is { item: (typeof items)[0]; product: SfProduct } =>
      Boolean(r.product)
    );

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="font-display text-2xl font-bold">Your cart is empty</p>
        <p className="mt-2 text-ink-soft">
          Add a few packs of makhana and come back.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex h-12 items-center rounded-full bg-terra px-7 font-semibold text-cream hover:bg-terra-dark"
        >
          Browse products
        </Link>
      </div>
    );
  }

  const total = rows.reduce(
    (sum, r) =>
      sum +
      (r.product.pricePerKg * r.product.packSizeGrams * r.item.packets) / 1000,
    0
  );
  const totalKg = rows.reduce(
    (sum, r) => sum + (r.product.packSizeGrams * r.item.packets) / 1000,
    0
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Your cart</h1>

      <div className="mt-5 space-y-3">
        {rows.map(({ item, product }) => {
          const lineTotal =
            (product.pricePerKg * product.packSizeGrams * item.packets) / 1000;
          const overStock =
            product.availablePackets > 0 &&
            item.packets > product.availablePackets;
          return (
            <div
              key={item.slug}
              className="rounded-2xl bg-card border border-line shadow-card p-3 flex gap-3"
            >
              <ProductImage
                slug={product.slug}
                name={product.name}
                packLabel={product.packLabel}
                className="h-20 w-20 shrink-0 rounded-xl"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/products/${product.slug}`}
                    className="font-semibold leading-snug hover:text-terra"
                  >
                    {product.name}
                  </Link>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => remove(item.slug)}
                    className="text-ink-soft hover:text-terra text-sm"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-ink-soft">
                  {formatINR(product.pricePerPacket)} per{" "}
                  {product.packLabel ?? "pack"}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <QtyStepper
                    small
                    value={item.packets}
                    min={1}
                    max={
                      product.availablePackets > 0
                        ? product.availablePackets
                        : undefined
                    }
                    onChange={(v) => setQty(item.slug, v)}
                  />
                  <p className="font-bold">{formatINR(lineTotal)}</p>
                </div>
                {overStock && (
                  <p className="mt-1 text-xs font-semibold text-terra">
                    Only {product.availablePackets} in stock — reduce quantity
                  </p>
                )}
                {!product.inStock && (
                  <p className="mt-1 text-xs font-semibold text-terra">
                    Currently out of stock — remove this item to continue
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl bg-card border border-line shadow-card p-4">
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>Total weight</span>
          <span>{formatKg(totalKg)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatINR(total)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Payment on delivery / as agreed — we&apos;ll confirm on WhatsApp.
        </p>
        <Link
          href="/checkout"
          className="mt-4 flex h-12 items-center justify-center rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark"
        >
          Continue to checkout
        </Link>
      </div>
    </div>
  );
}
