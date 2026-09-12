"use client";

import { useState } from "react";
import type { SfPaymentDue } from "@/lib/salesforce";
import { formatDate, formatINR } from "@/lib/format";

/**
 * Shown in place of the checkout form when Salesforce reports a delivered
 * order that has gone unpaid past the limit. The customer pays by scanning
 * the PhonePe QR (any UPI app works), and once the payment is recorded in
 * Salesforce the block lifts on the next check.
 *
 * Drop the QR image at public/pay/phonepe-qr.png. Set NEXT_PUBLIC_UPI_VPA
 * (and optionally NEXT_PUBLIC_UPI_PAYEE) to also offer a one-tap "Pay"
 * button on phones that opens the UPI app with the amount pre-filled.
 */
export default function PaymentDueBlock({
  due,
  onRecheck,
}: {
  due: SfPaymentDue;
  onRecheck: () => Promise<boolean>;
}) {
  const [checking, setChecking] = useState(false);
  const [stillDue, setStillDue] = useState(false);
  const [qrMissing, setQrMissing] = useState(false);

  const vpa = process.env.NEXT_PUBLIC_UPI_VPA;
  const payee = process.env.NEXT_PUBLIC_UPI_PAYEE ?? "Nutty Nirvana";
  const orderNames = due.overdue.map((o) => o.saleName).join(", ");
  const upiLink = vpa
    ? `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payee)}` +
      `&am=${due.totalDue.toFixed(2)}&cu=INR` +
      `&tn=${encodeURIComponent(`Nutty Nirvana ${orderNames}`.slice(0, 50))}`
    : null;

  async function recheck() {
    setChecking(true);
    setStillDue(false);
    try {
      const cleared = await onRecheck();
      if (!cleared) setStillDue(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-card border border-terra/40 shadow-card p-5">
      <h2 className="font-display text-xl font-bold text-terra-dark">
        Please clear your pending payment first
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        You have a payment pending for more than {due.daysLimit} days. Once
        it is paid, you will be able to place your order.
      </p>

      <ul className="mt-4 divide-y divide-line rounded-xl border border-line text-sm">
        {due.overdue.map((o) => (
          <li key={o.saleId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div>
              <p className="font-semibold">{o.saleName}</p>
              <p className="text-xs text-ink-soft">
                Delivered {formatDate(o.saleDate)} · {o.daysOld} days ago
              </p>
            </div>
            <span className="font-semibold text-terra-dark shrink-0">
              {formatINR(o.balanceDue)}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between px-4 py-2.5 font-bold">
          <span>Total to pay</span>
          <span>{formatINR(due.totalDue)}</span>
        </li>
      </ul>

      <div className="mt-5 rounded-xl bg-cream-2 p-4 text-center">
        <p className="text-sm font-semibold">Pay by UPI</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          Scan with PhonePe, Google Pay, Paytm or any UPI app
        </p>
        {!qrMissing ? (
          // A static asset the owner drops in; next/image would need
          // dimensions it cannot know in advance.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/pay/phonepe-qr.png"
            alt="Nutty Nirvana PhonePe UPI QR code"
            className="mx-auto mt-3 w-56 max-w-full rounded-xl bg-white p-2"
            onError={() => setQrMissing(true)}
          />
        ) : (
          <p className="mt-3 text-xs text-ink-soft">
            QR code unavailable right now. Please pay to the UPI ID shared
            with you on WhatsApp.
          </p>
        )}
        {upiLink && (
          <a
            href={upiLink}
            className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-terra px-6 text-sm font-semibold text-cream hover:bg-terra-dark"
          >
            Pay {formatINR(due.totalDue)} in UPI app
          </a>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          Please mention your order number ({orderNames}) in the payment
          remark. You will get a WhatsApp confirmation once we record it.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void recheck()}
        disabled={checking}
        className="mt-4 h-12 w-full rounded-full border border-ink/20 font-semibold hover:bg-cream-2 disabled:opacity-50"
      >
        {checking ? "Checking…" : "I have paid — check again"}
      </button>
      {stillDue && (
        <p className="mt-2 text-center text-xs text-ink-soft">
          Still showing as pending. Payments are recorded by our team once
          they reach us, usually the same day. You will get a WhatsApp
          message as soon as it is done.
        </p>
      )}
    </div>
  );
}
