"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import type { SfProduct } from "@/lib/salesforce";
import { brandTheme } from "@/lib/brand";
import { discountPercent, formatINR, formatKg } from "@/lib/format";
import {
  MORPH_EASE,
  createBloom,
  reducedMotion,
  takeLift,
  type MorphOrigin,
} from "@/lib/productMorph";
import { useCart } from "@/components/CartProvider";
import ProductImage from "@/components/ProductImage";
import ProductVideo from "@/components/ProductVideo";
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
  const [closing, setClosing] = useState(false);
  /** The entry animation has finished (or there wasn't one). */
  const [revealed, setRevealed] = useState(false);

  const theme = brandTheme(product.slug);
  const panelRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  /** Where the product card's photo was, when we arrived from one. */
  const originRef = useRef<MorphOrigin | null>(null);

  const out = !product.inStock;
  const lowStock =
    product.inStock && product.availablePackets <= Math.max(5, min);
  const kgForQty = (qty * product.packSizeGrams) / 1000;
  const off = discountPercent(
    product.mrpPerPacket ?? 0,
    product.pricePerPacket,
  );

  /**
   * Grows the brand panel out of the card's photo ("open"), or shrinks it
   * back onto it ("close"). On close the shrunken layer and a copy of the
   * photo stay on screen for the product card to pick up.
   */
  function runMorph(direction: "open" | "close"): Promise<unknown> {
    const origin = originRef.current!;
    const panel = panelRef.current!;
    const logo = logoRef.current!;
    const opening = direction === "open";

    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const p = panel.getBoundingClientRect();
    const l = logo.getBoundingClientRect();

    const atCard = {
      clipPath: `inset(${origin.top}px ${vw - origin.left - origin.width}px ${vh - origin.top - origin.height}px ${origin.left}px round 16px)`,
    };
    const atPanel = {
      clipPath: `inset(${p.top}px ${vw - p.right}px ${vh - p.bottom}px ${p.left}px round 0px)`,
    };
    const logoAtCard = {
      transform: `translate(${origin.left + origin.width / 2 - (l.left + l.width / 2)}px, ${origin.top + origin.height / 2 - (l.top + l.height / 2)}px) scale(${origin.width / l.width})`,
    };
    const logoHome = { transform: "translate(0px, 0px) scale(1)" };

    const inOrder = <T,>(start: T, end: T) =>
      opening ? [start, end] : [end, start];
    const timing: KeyframeAnimationOptions = {
      duration: opening ? 620 : 420,
      easing: MORPH_EASE,
      fill: "forwards",
    };

    const bloom = createBloom(theme.from, product.slug);
    panel.style.backgroundColor = "transparent";

    const done = Promise.all([
      bloom.animate(inOrder(atCard, atPanel), timing).finished,
      logo.animate(inOrder(logoAtCard, logoHome), timing).finished,
    ]);

    const wide = window.matchMedia("(min-width: 768px)").matches;
    const items =
      detailsRef.current?.querySelectorAll<HTMLElement>("[data-nnp-item]") ??
      [];
    items.forEach((el, i) => {
      if (opening) {
        el.animate(
          [
            {
              opacity: 0,
              transform: wide ? "translateX(32px)" : "translateY(18px)",
            },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 400,
            delay: 200 + i * 45,
            easing: "cubic-bezier(.2,.7,.2,1)",
            fill: "backwards",
          },
        );
      } else {
        el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 140,
          fill: "forwards",
        });
      }
    });
    panel.querySelectorAll<HTMLElement>("[data-nnp-chrome]").forEach((el) => {
      el.animate(
        opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        opening
          ? { duration: 300, delay: 420, fill: "backwards" }
          : { duration: 120, fill: "forwards" },
      );
    });

    return done.then(() => {
      if (opening) {
        bloom.remove();
        panel.style.backgroundColor = theme.from;
        logo.getAnimations().forEach((a) => a.cancel());
        return;
      }
      const copy = logo.cloneNode(true) as HTMLElement;
      // A cloned <video> would restart from blank; the photo is enough.
      copy.querySelectorAll("video, button").forEach((n) => n.remove());
      Object.assign(copy.style, {
        position: "fixed",
        left: `${l.left}px`,
        top: `${l.top}px`,
        width: `${l.width}px`,
        height: `${l.height}px`,
        margin: "0",
        transform: logoAtCard.transform,
      });
      bloom.appendChild(copy);
      // The card normally removes it on mount; don't strand it otherwise.
      setTimeout(() => bloom.remove(), 2500);
    });
  }

  // Arriving from a product card: grow out of its photo before first paint.
  useLayoutEffect(() => {
    const origin = takeLift(product.slug);
    if (!origin || reducedMotion()) {
      setRevealed(true);
      return;
    }
    originRef.current = origin;
    window.scrollTo({ top: 0, behavior: "instant" });
    runMorph("open").then(() => setRevealed(true));
    // runMorph reads refs and props captured for this product only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  async function close() {
    if (closing) return;
    if (!originRef.current) {
      router.push("/products");
      return;
    }
    if (reducedMotion()) {
      router.back();
      return;
    }
    setClosing(true);
    window.scrollTo({ top: 0, behavior: "instant" });
    await runMorph("close");
    router.back();
  }

  return (
    <div className="md:grid md:min-h-[calc(100vh-4rem)] md:grid-cols-2">
      {/* Brand panel: left half on desktop, top of the page on phones */}
      <div
        ref={panelRef}
        className="relative z-[31] h-[52vh] min-h-[340px] md:sticky md:top-16 md:h-[calc(100vh-4rem)]"
        style={{ backgroundColor: theme.from }}
      >
        <div
          data-nnp-chrome
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <span
            className="absolute -bottom-[0.18em] left-1/2 -translate-x-1/2 whitespace-nowrap font-display text-[24vw] font-black leading-none opacity-10 md:text-[12vw]"
            style={{ color: theme.accent }}
          >
            {theme.short}
          </span>
        </div>

        <button
          type="button"
          onClick={close}
          data-nnp-chrome
          className="absolute left-4 top-4 z-10 inline-flex h-10 items-center rounded-full bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          ← Back
        </button>

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            ref={logoRef}
            className="relative isolate aspect-[4/3] w-[min(82%,48vh)] overflow-hidden rounded-3xl shadow-2xl md:w-[min(78%,80vh,40rem)]"
          >
            <ProductImage
              slug={product.slug}
              name={product.name}
              packLabel={product.packLabel}
              className="h-full w-full"
            />
            <ProductVideo
              slug={product.slug}
              name={product.name}
              start={revealed}
            />
          </div>
        </div>
      </div>

      {/* Details */}
      <div
        ref={detailsRef}
        className="px-5 py-8 sm:px-8 md:flex md:flex-col md:justify-center md:px-10 md:py-12 lg:px-16"
      >
        <div className="max-w-md">
          {product.badge && (
            <span
              data-nnp-item
              className="inline-block rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gold"
            >
              {product.badge}
            </span>
          )}
          <h1
            data-nnp-item
            className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl"
          >
            {product.name}
          </h1>
          {product.grade && (
            <p data-nnp-item className="mt-1 text-ink-soft">
              {product.grade}
            </p>
          )}

          <div data-nnp-item className="mt-4">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-3xl font-bold">
              {formatINR(product.pricePerPacket)}
              {off > 0 && (
                <>
                  <span className="text-xl font-semibold text-ink-soft line-through">
                    {formatINR(product.mrpPerPacket!)}
                  </span>
                  <span className="rounded-full bg-leaf/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-leaf">
                    Save {off}%
                  </span>
                </>
              )}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              per {product.packLabel ?? "pack"} ·{" "}
              {formatINR(product.pricePerKg)}/kg
            </p>
          </div>

          <div data-nnp-item className="mt-2 text-sm">
            {out ? (
              <span className="font-semibold text-pine">
                Out of stock — check back soon
              </span>
            ) : lowStock ? (
              <span className="font-semibold text-pine">
                Only {product.availablePackets} left in stock
              </span>
            ) : (
              <span className="font-semibold text-leaf">In stock</span>
            )}
          </div>

          {product.description && (
            <p
              data-nnp-item
              className="mt-4 text-sm leading-relaxed text-ink-soft"
            >
              {product.description}
            </p>
          )}

          <ul data-nnp-item className="mt-4 space-y-1 text-sm text-ink-soft">
            <li>• Process: hand-picked, sun-dried, plain (unroasted)</li>
            <li>• Shelf life: 12 months</li>
            {product.packLabel && <li>• Pack: {product.packLabel}</li>}
          </ul>

          {!out && (
            <div
              data-nnp-item
              className="mt-6 flex flex-wrap items-center gap-3"
            >
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

          <div data-nnp-item className="mt-5 flex flex-wrap gap-3">
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
                  ? "bg-mist-2 text-ink-soft cursor-not-allowed"
                  : added
                    ? "bg-leaf text-mist"
                    : "bg-pine text-mist hover:bg-pine-dark"
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
              className="rounded-full border border-ink/20 px-7 h-12 font-semibold hover:bg-mist-2 transition-colors disabled:opacity-40"
            >
              Buy now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
