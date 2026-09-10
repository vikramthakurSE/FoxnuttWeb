"use client";

import { useState } from "react";
import type { SfPastOrder } from "@/lib/salesforce";
import { formatINR } from "@/lib/format";

/**
 * Cancel or adjust a live order.
 *
 * Only quantities change here, and dropping every line is refused — an empty
 * order is a cancellation, and saying so avoids leaving a zero-value sale
 * sitting in the books.
 */
export default function OrderActions({
  order,
  onDone,
}: {
  order: SfPastOrder;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "modify" | "confirmCancel">("idle");
  const [packs, setPacks] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      order.items
        .filter((i) => i.lineId)
        .map((i) => [i.lineId as string, i.packets ?? 0])
    )
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = order.items.filter((i) => i.lineId);
  const changed = lines.some(
    (i) => packs[i.lineId as string] !== (i.packets ?? 0)
  );
  const allZero = lines.every((i) => (packs[i.lineId as string] ?? 0) === 0);

  const newTotal = lines.reduce((sum, i) => {
    const p = packs[i.lineId as string] ?? 0;
    const perPack = i.packets ? (i.quantityKg / i.packets) * i.ratePerKg : 0;
    return sum + p * perPack;
  }, 0);

  async function run(path: string, body: object, failMsg: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? failMsg);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : failMsg);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "idle") {
    return (
      <div className="mt-3 flex gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setMode("modify")}
          className="h-10 flex-1 rounded-full border border-line text-sm font-semibold text-ink hover:bg-cream-2"
        >
          Modify
        </button>
        <button
          type="button"
          onClick={() => setMode("confirmCancel")}
          className="h-10 flex-1 rounded-full border border-terra/40 text-sm font-semibold text-terra hover:bg-terra/5"
        >
          Cancel order
        </button>
      </div>
    );
  }

  if (mode === "confirmCancel") {
    return (
      <div className="mt-3 rounded-xl border border-terra/30 bg-terra/5 p-3">
        <p className="text-sm">
          Cancel <span className="font-semibold">{order.saleName}</span>? We
          will confirm this on your WhatsApp.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                "/api/orders/cancel",
                { saleId: order.saleId },
                "Could not cancel that order."
              )
            }
            className="h-10 flex-1 rounded-full bg-terra text-sm font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
          >
            {busy ? "Cancelling…" : "Yes, cancel it"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("idle")}
            className="h-10 flex-1 rounded-full border border-line text-sm font-semibold hover:bg-cream-2"
          >
            Keep order
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-terra-dark">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-cream-2 p-3">
      <p className="text-sm font-semibold">Change quantities</p>
      {lines.map((i) => {
        const id = i.lineId as string;
        const value = packs[id] ?? 0;
        return (
          <div key={id} className="mt-2 flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-sm">
              {i.brand} {i.packetType}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Reduce"
                onClick={() =>
                  setPacks((p) => ({ ...p, [id]: Math.max(0, value - 1) }))
                }
                className="h-8 w-8 rounded-full border border-line bg-card font-bold"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-semibold">
                {value}
              </span>
              <button
                type="button"
                aria-label="Increase"
                onClick={() => setPacks((p) => ({ ...p, [id]: value + 1 }))}
                className="h-8 w-8 rounded-full border border-line bg-card font-bold"
              >
                +
              </button>
            </div>
          </div>
        );
      })}

      <div className="mt-3 flex justify-between border-t border-line pt-2 text-sm font-bold">
        <span>New total</span>
        <span>{formatINR(newTotal)}</span>
      </div>

      {allZero && (
        <p className="mt-2 text-xs text-terra-dark">
          An order needs at least one item — use Cancel order instead.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy || !changed || allZero}
          onClick={() =>
            void run(
              "/api/orders/modify",
              { saleId: order.saleId, lines: packs },
              "Could not update that order."
            )
          }
          className="h-10 flex-1 rounded-full bg-terra text-sm font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode("idle")}
          className="h-10 flex-1 rounded-full border border-line text-sm font-semibold hover:bg-cream-2"
        >
          Discard
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-terra-dark">{error}</p>}
    </div>
  );
}
