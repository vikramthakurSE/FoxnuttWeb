"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SfPastOrder } from "@/lib/salesforce";
import { formatDate, formatINR, formatKg } from "@/lib/format";
import PhoneVerify from "@/components/PhoneVerify";

const STATUS_STYLES: Record<string, string> = {
  "Pending Approval": "bg-gold/15 text-gold",
  Confirmed: "bg-leaf/15 text-leaf",
  "Out for Delivery": "bg-terra/10 text-terra",
  Delivered: "bg-leaf/15 text-leaf",
  Cancelled: "bg-ink/10 text-ink-soft",
  Received: "bg-gold/15 text-gold",
};

export default function OrdersPage() {
  const [state, setState] = useState<
    "loading" | "verify" | "list" | "error"
  >("loading");
  const [orders, setOrders] = useState<SfPastOrder[]>([]);
  const [phone, setPhone] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.status === 401) {
      setState("verify");
      return;
    }
    if (!res.ok) {
      setState("error");
      return;
    }
    const json = await res.json();
    setOrders(json.orders as SfPastOrder[]);
    setState("list");
  }, []);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.phone) {
          setPhone(d.session.phone as string);
          void loadOrders();
        } else {
          setState("verify");
        }
      })
      .catch(() => setState("verify"));
  }, [loadOrders]);

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setPhone(null);
    setOrders([]);
    setState("verify");
  }

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-ink-soft">
        Loading your orders…
      </div>
    );
  }

  if (state === "verify") {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="font-display text-3xl font-bold">My orders</h1>
        <div className="mt-5 rounded-2xl bg-card border border-line shadow-card p-5">
          <p className="mb-4 text-sm text-ink-soft">
            Verify your WhatsApp number to see your order history and live
            status.
          </p>
          <PhoneVerify
            onVerified={(p) => {
              setPhone(p);
              setState("loading");
              void loadOrders();
            }}
          />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-ink-soft">
          Could not load your orders right now — please try again in a minute.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">My orders</h1>
        <div className="text-right text-sm">
          {phone && <p className="text-ink-soft">+91 {phone}</p>}
          <button
            type="button"
            onClick={() => void logout()}
            className="font-semibold text-terra hover:underline"
          >
            Log out
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-ink-soft">No orders yet on this number.</p>
          <Link
            href="/products"
            className="mt-5 inline-flex h-12 items-center rounded-full bg-terra px-7 font-semibold text-cream hover:bg-terra-dark"
          >
            Place your first order
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {orders.map((o) => (
            <div
              key={o.saleId}
              className="rounded-2xl bg-card border border-line shadow-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{o.saleName}</p>
                  <p className="text-xs text-ink-soft">
                    {formatDate(o.saleDate)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[o.status] ?? "bg-ink/10 text-ink-soft"
                  }`}
                >
                  {o.status}
                </span>
              </div>

              {o.items.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm text-ink-soft">
                  {o.items.map((it, idx) => (
                    <li key={idx} className="flex justify-between gap-2">
                      <span>
                        {it.brand} · {formatKg(it.quantityKg)}
                        {it.packets ? ` (${it.packets} packs)` : ""}
                      </span>
                      {it.lineAmount != null && (
                        <span className="shrink-0">
                          {formatINR(it.lineAmount)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                <span className="font-bold text-base">
                  {o.total != null ? formatINR(o.total) : "—"}
                </span>
                <span className="text-ink-soft">
                  {o.balanceDue != null && o.balanceDue > 0
                    ? `Balance due: ${formatINR(o.balanceDue)}`
                    : o.status === "Delivered"
                      ? "Fully settled"
                      : o.expectedDelivery
                        ? `Expected: ${formatDate(o.expectedDelivery)}`
                        : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
