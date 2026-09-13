"use client";

import { useState } from "react";
import { formatINR } from "@/lib/format";

/**
 * The one way to pay us: scan the PhonePe QR, or copy the UPI ID into any
 * UPI app. No deep links — UPI apps decline upi:// intents that point at a
 * personal (non-merchant) UPI ID, so a "Pay in app" button can never
 * complete. The defaults are decoded from the QR in public/pay; env vars
 * override them if the receiving account changes.
 */
export const UPI_VPA = process.env.NEXT_PUBLIC_UPI_VPA || "9620405311-4@ybl";
export const UPI_PAYEE = process.env.NEXT_PUBLIC_UPI_PAYEE || "VIKRAM KUMAR";

export default function UpiPayCard({
  amount,
  orderNames,
}: {
  amount: number;
  /** Order number(s) the customer may mention in the remark. */
  orderNames: string;
}) {
  const [qrMissing, setQrMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(UPI_VPA);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked (http, old browser): the ID is on screen anyway.
    }
  }

  return (
    <div className="rounded-xl bg-cream-2 p-4 text-center">
      <p className="text-sm font-semibold">Pay {formatINR(amount)} by UPI</p>
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
          QR code unavailable right now. Please pay to the UPI ID below.
        </p>
      )}
      <div className="mt-4 rounded-xl border border-line bg-card px-4 py-3 text-left">
        <p className="text-xs font-semibold text-ink-soft">
          On this phone? Pay to our UPI ID instead
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="font-mono text-sm font-semibold break-all">{UPI_VPA}</span>
          <button
            type="button"
            onClick={() => void copyUpiId()}
            className="h-9 shrink-0 rounded-full bg-terra px-4 text-xs font-semibold text-cream hover:bg-terra-dark"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-soft">
          {UPI_PAYEE} · open PhonePe, Google Pay or Paytm, choose{" "}
          <span className="font-semibold">Pay to UPI ID</span>, paste, and
          enter {formatINR(amount)}.
        </p>
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        Optional: mention your order number ({orderNames}) in the payment
        remark. You will get a WhatsApp confirmation once we record it.
      </p>
    </div>
  );
}
