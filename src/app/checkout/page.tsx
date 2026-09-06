"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SfProduct } from "@/lib/salesforce";
import { formatINR } from "@/lib/format";
import { useCart } from "@/components/CartProvider";
import PhoneVerify, { type VerifiedCustomer } from "@/components/PhoneVerify";

type Step = "verify" | "details" | "done";

interface PlacedOrder {
  saleName: string | null;
  status: string;
  newCustomer: boolean;
  total: number;
}

export default function CheckoutPage() {
  const { items, clear, ready } = useCart();
  const [products, setProducts] = useState<SfProduct[] | null>(null);
  const [step, setStep] = useState<Step>("verify");
  const [phone, setPhone] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  // Already verified in this browser? Skip the OTP step.
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.phone) {
          setPhone(d.session.phone as string);
          if (d.session.name) setName(d.session.name as string);
          setStep((s) => (s === "verify" ? "details" : s));
        }
      })
      .catch(() => {});
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => setProducts(d.products as SfProduct[]))
      .catch(() => setProducts([]));
  }, []);

  const rows =
    products === null
      ? []
      : items
          .map((i) => ({
            item: i,
            product: products.find((p) => p.slug === i.slug),
          }))
          .filter(
            (r): r is { item: (typeof items)[0]; product: SfProduct } =>
              Boolean(r.product)
          );

  const total = rows.reduce(
    (sum, r) =>
      sum +
      (r.product.pricePerKg * r.product.packSizeGrams * r.item.packets) / 1000,
    0
  );

  async function submitOrder() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ slug: i.slug, packets: i.packets })),
          name,
          businessName,
          address,
          gstin,
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not place the order.");
      setPlaced({
        saleName: json.saleName,
        status: json.status,
        newCustomer: json.newCustomer,
        total: json.total,
      });
      clear();
      setStep("done");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // ── Empty cart guard ───────────────────────────────────────────────────
  if (ready && items.length === 0 && step !== "done") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-display text-2xl font-bold">Nothing to check out</p>
        <Link
          href="/products"
          className="mt-6 inline-flex h-12 items-center rounded-full bg-terra px-7 font-semibold text-cream hover:bg-terra-dark"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      {step !== "done" && (
        <>
          <h1 className="font-display text-3xl font-bold">Checkout</h1>

          {/* Order summary */}
          <div className="mt-4 rounded-2xl bg-card border border-line shadow-card p-4 text-sm">
            {rows.map(({ item, product }) => (
              <div
                key={item.slug}
                className="flex justify-between gap-2 py-1"
              >
                <span className="text-ink-soft">
                  {product.name} × {item.packets}
                </span>
                <span className="font-semibold shrink-0">
                  {formatINR(
                    (product.pricePerKg *
                      product.packSizeGrams *
                      item.packets) /
                      1000
                  )}
                </span>
              </div>
            ))}
            <div className="mt-2 border-t border-line pt-2 flex justify-between font-bold text-base">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>
        </>
      )}

      {/* Step 1 — verify phone */}
      {step === "verify" && (
        <div className="mt-6 rounded-2xl bg-card border border-line shadow-card p-5">
          <h2 className="font-display text-xl font-bold">
            Verify your number
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink-soft">
            We use your WhatsApp number to link your orders and send updates.
          </p>
          <PhoneVerify
            onVerified={(p, customer: VerifiedCustomer | null) => {
              setPhone(p);
              if (customer) {
                if (customer.name) setName(customer.name);
                if (customer.business_name)
                  setBusinessName(customer.business_name);
                if (customer.address) setAddress(customer.address);
                if (customer.gstin) setGstin(customer.gstin);
              }
              setStep("details");
            }}
          />
        </div>
      )}

      {/* Step 2 — details + place order */}
      {step === "details" && (
        <form
          className="mt-6 rounded-2xl bg-card border border-line shadow-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submitOrder();
          }}
        >
          <h2 className="font-display text-xl font-bold">Delivery details</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Ordering as <span className="font-semibold">+91 {phone}</span>
          </p>

          <label className="mt-4 block text-sm font-semibold" htmlFor="nn-name">
            Your name *
          </label>
          <input
            id="nn-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-terra"
          />

          <label
            className="mt-4 block text-sm font-semibold"
            htmlFor="nn-business"
          >
            Shop / business name (optional)
          </label>
          <input
            id="nn-business"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-terra"
          />

          <label
            className="mt-4 block text-sm font-semibold"
            htmlFor="nn-address"
          >
            Delivery address *
          </label>
          <textarea
            id="nn-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-terra"
          />

          <label className="mt-4 block text-sm font-semibold" htmlFor="nn-gstin">
            GSTIN (optional)
          </label>
          <input
            id="nn-gstin"
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            maxLength={15}
            className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-terra"
          />

          <label className="mt-4 block text-sm font-semibold" htmlFor="nn-note">
            Note for us (optional)
          </label>
          <textarea
            id="nn-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-terra"
          />

          {error && (
            <p className="mt-4 rounded-xl bg-terra/10 border border-terra/30 px-4 py-2.5 text-sm text-terra-dark">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
          >
            {busy ? "Placing order…" : `Place order · ${formatINR(total)}`}
          </button>
          <p className="mt-2 text-center text-xs text-ink-soft">
            Payment on delivery / as agreed. No online payment needed.
          </p>
        </form>
      )}

      {/* Step 3 — confirmation */}
      {step === "done" && placed && (
        <div className="rounded-2xl bg-card border border-line shadow-card p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf/15 text-3xl">
            ✓
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">
            {placed.status === "Confirmed"
              ? "Order confirmed!"
              : "Order received!"}
          </h1>
          {placed.saleName && (
            <p className="mt-1 text-sm text-ink-soft">
              Order number:{" "}
              <span className="font-semibold text-ink">{placed.saleName}</span>
            </p>
          )}
          <p className="mt-3 text-sm text-ink-soft">
            {placed.status === "Confirmed"
              ? "Your order is confirmed — the confirmation is on its way to your WhatsApp."
              : placed.newCustomer
                ? "Since this is your first order with us, we'll quickly review it and confirm on WhatsApp shortly."
                : "We've received your order and will confirm it on WhatsApp shortly."}
          </p>
          <p className="mt-1 font-bold">{formatINR(placed.total)}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/orders"
              className="h-12 rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark flex items-center justify-center"
            >
              View my orders
            </Link>
            <Link
              href="/products"
              className="h-12 rounded-full border border-ink/20 font-semibold hover:bg-cream-2 flex items-center justify-center"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
