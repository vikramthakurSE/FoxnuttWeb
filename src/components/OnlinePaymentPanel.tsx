"use client";

import Link from "next/link";
import { useCallback } from "react";
import { formatINR } from "@/lib/format";
import { usePaymentWatch, WaitingFooter } from "@/lib/usePaymentWatch";
import UpiPayCard from "@/components/UpiPayCard";
import PaymentSuccess from "@/components/PaymentSuccess";

/**
 * Shown right after an order is placed with "Pay online", and again from
 * the orders page for an online order that is still unpaid. Polls the
 * order's payment state until the bank alert books the payment.
 */
export default function OnlinePaymentPanel({
  orderRef,
  saleName,
  amount,
  onPaid,
  compact = false,
}: {
  orderRef: string;
  /** Salesforce order number; null while the order is still syncing. */
  saleName: string | null;
  amount: number;
  onPaid?: () => void;
  /** Inside the orders list: no page-level links after success. */
  compact?: boolean;
}) {
  const check = useCallback(async () => {
    const res = await fetch(
      `/api/orders/payment?ref=${encodeURIComponent(orderRef)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return false;
    const d = (await res.json()) as { found: boolean; paid?: boolean };
    return d.found && d.paid === true;
  }, [orderRef]);

  const { paid, checking, stillDue, recheck } = usePaymentWatch(check);
  const label = saleName ?? "your order";

  if (paid) {
    if (onPaid) onPaid();
    return (
      <PaymentSuccess
        title="Payment received, thank you!"
        message={
          <>
            {formatINR(amount)} is recorded against {label}. Your order is
            fully paid — nothing to pay on delivery. A WhatsApp confirmation
            is on its way.
          </>
        }
      >
        <a
          href={`/api/orders/receipt?ref=${orderRef}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-full border border-ink/20 font-semibold hover:bg-cream-2 flex items-center justify-center gap-2 ${
            compact ? "h-11 text-sm" : "h-12"
          }`}
        >
          📄 Download receipt
        </a>
        {!compact && (
          <div className="mt-2 flex flex-col gap-2">
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
        )}
      </PaymentSuccess>
    );
  }

  return (
    <div className="mt-6 rounded-2xl bg-card border border-gold/50 shadow-card p-5">
      <h2 className="font-display text-xl font-bold">
        Complete your payment
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        {saleName ? (
          <>
            Order <span className="font-semibold text-ink">{saleName}</span> ·{" "}
          </>
        ) : null}
        Amount to pay{" "}
        <span className="font-semibold text-ink">{formatINR(amount)}</span>
      </p>

      <div className="mt-4 flex gap-3 rounded-xl border border-leaf/40 bg-leaf/10 px-4 py-3 text-sm">
        <span className="text-xl" aria-hidden="true">🔒</span>
        <div>
          <p className="font-semibold text-ink">Your order is safe with us</p>
          <p className="mt-0.5 text-ink-soft">
            It is already recorded under your number. Pay whenever you are
            ready — this page confirms by itself the moment your payment
            reaches us, and you also get a WhatsApp receipt. If anything
            goes wrong, we will sort it out; you will never lose money or
            your order.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <UpiPayCard amount={amount} orderNames={label} />
      </div>

      <WaitingFooter checking={checking} stillDue={stillDue} onRecheck={() => void recheck()} />
    </div>
  );
}
