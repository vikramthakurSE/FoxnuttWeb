"use client";

import { formatINR } from "@/lib/format";
import {
  formatKgShort,
  placeLabel,
  type OrderTotals as Totals,
} from "@/lib/delivery";
import type { ResolvedPincode } from "./DeliveryProvider";

/**
 * Products, the GST already inside that price, delivery and total for the
 * cart and checkout, with what is missing when the PIN code needs a minimum
 * weight per brand.
 */
export default function OrderTotals({
  totals,
  pin,
  totalKg,
}: {
  totals: Totals;
  pin: ResolvedPincode | null;
  totalKg?: number;
}) {
  const { productsIncl, gst, quote, total } = totals;
  return (
    <div className="text-sm">
      {totalKg != null && (
        <Row label="Total weight" value={formatKgShort(totalKg)} muted />
      )}
      <Row label="Products" value={formatINR(productsIncl)} muted />
      <Row label="Includes GST (5%)" value={formatINR(gst)} muted />
      <Row
        label="Delivery"
        value={
          !quote
            ? "Enter PIN code"
            : quote.charge > 0
              ? formatINR(quote.charge)
              : "Free"
        }
        muted
      />
      <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold">
        <span>Total</span>
        <span>{formatINR(total)}</span>
      </div>

      {pin && quote && quote.shortfalls.length > 0 && (
        <div role="alert" className="mt-3 rounded-xl border border-gold/50 bg-gold/10 px-3 py-2.5">
          <p className="font-semibold text-ink">
            Minimum order for {placeLabel(pin.location)}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
            {quote.shortfalls.map((f) => (
              <li key={f.brand}>
                Add <span className="font-semibold text-ink">{formatKgShort(f.minKg - f.kg)}</span>{" "}
                more {f.brand} (min {formatKgShort(f.minKg)}, you have {formatKgShort(f.kg)})
              </li>
            ))}
          </ul>
        </div>
      )}
      {pin && quote && quote.charge > 0 && quote.shortfalls.length === 0 && (
        <p className="mt-2 text-xs text-ink-soft">
          Delivery to {placeLabel(pin.location)}: ₹{pin.rules.chargePerKg}/kg
          {pin.rules.maxCharge != null ? `, max ₹${pin.rules.maxCharge}` : ""}. No GST on delivery.
        </p>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 py-0.5 ${muted ? "text-ink-soft" : ""}`}>
      <span>{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
