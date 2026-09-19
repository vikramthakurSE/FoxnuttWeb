"use client";

import Spinner from "@/components/Spinner";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SfPastOrder } from "@/lib/salesforce";
import { formatDate, formatINR, formatKg } from "@/lib/format";
import OrderActions from "@/components/OrderActions";
import BusinessCodeLogin from "@/components/BusinessCodeLogin";
import PayDuePanel from "@/components/PayDuePanel";

const STATUS_STYLES: Record<string, string> = {
  "Pending Approval": "bg-gold/15 text-gold",
  Confirmed: "bg-leaf/15 text-leaf",
  "Out for Delivery": "bg-pine/10 text-pine",
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
  const [codeVerified, setCodeVerified] = useState(false);
  // Which order with a due balance has its payment panel open.
  const [payingSaleId, setPayingSaleId] = useState<string | null>(null);

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
      <div role="status" className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center text-ink-soft">
        <Spinner size={32} className="text-pine" />
        <p className="mt-3">Loading your orders…</p>
      </div>
    );
  }

  if (state === "verify") {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="font-display text-3xl font-bold">My orders</h1>
        <div className={`mt-5 rounded-2xl bg-card border border-line shadow-card p-6 ${codeVerified ? "nn-card-wobble" : ""}`}>
          <BusinessCodeLogin
            title="Enter your business code"
            subtitle="See your order history and live delivery status."
            continueLabel="View my orders"
            onStageChange={(st) => setCodeVerified(st === "verified")}
            onLoggedIn={() => {
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
            className="font-semibold text-pine hover:underline"
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
            className="mt-5 inline-flex h-12 items-center rounded-full bg-pine px-7 font-semibold text-mist hover:bg-pine-dark"
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
                  {(o.deliveryCharge ?? 0) > 0 && (
                    <li className="flex justify-between gap-2">
                      <span>Delivery{o.deliveryPincode ? ` to ${o.deliveryPincode}` : ""}</span>
                      <span className="shrink-0">{formatINR(o.deliveryCharge ?? 0)}</span>
                    </li>
                  )}
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

              {o.status === "Cancelled" && (() => {
                const amount = o.refundAmount ?? o.collected ?? 0;
                if (o.refundStatus === "Refunded") {
                  return (
                    <div className="mt-3 rounded-xl border border-leaf/40 bg-leaf/10 px-4 py-3 text-sm">
                      <p className="font-semibold text-ink">✓ Refunded {formatINR(amount)}</p>
                      <p className="mt-0.5 text-ink-soft">
                        {o.refundedOn
                          ? `Credited back to you on ${formatDate(o.refundedOn)}.`
                          : "Credited back to you."}{" "}
                        We sent the confirmation on WhatsApp.
                      </p>
                    </div>
                  );
                }
                if (amount > 0) {
                  return (
                    <div className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
                      <p className="font-semibold text-ink">
                        Refund of {formatINR(amount)} on its way
                      </p>
                      <p className="mt-0.5 text-ink-soft">
                        This order was cancelled. Your payment will be credited
                        back to you within 24–48 hours, and you&apos;ll get a
                        WhatsApp message once it&apos;s done.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="mt-3 rounded-xl border border-line bg-mist-2 px-4 py-3 text-sm text-ink-soft">
                    This order was cancelled. No payment was taken, so there&apos;s
                    nothing to refund.
                  </div>
                );
              })()}

              {o.orderRef &&
                o.status !== "Cancelled" &&
                (o.balanceDue ?? 0) <= 0 &&
                (o.collected ?? 0) > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <a
                      href={`/api/orders/receipt?ref=${o.orderRef}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/20 text-sm font-semibold hover:bg-mist-2"
                    >
                      📄 Download receipt
                    </a>
                  </div>
                )}

              {o.status !== "Cancelled" && (o.balanceDue ?? 0) > 0 && (
                <div className="mt-3 border-t border-line pt-3">
                  {payingSaleId === o.saleId ? (
                    <PayDuePanel
                      saleId={o.saleId}
                      saleName={o.saleName}
                      balanceDue={o.balanceDue ?? 0}
                      compact
                      onPaid={() => {
                        setPayingSaleId(null);
                        void loadOrders();
                      }}
                      onCancel={() => setPayingSaleId(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPayingSaleId(o.saleId)}
                      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-pine text-sm font-semibold text-mist hover:bg-pine-dark"
                    >
                      Pay {formatINR(o.balanceDue ?? 0)} <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              )}

              {o.editable && (
                <OrderActions
                  order={o}
                  onDone={() => {
                    setState("loading");
                    void loadOrders();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
