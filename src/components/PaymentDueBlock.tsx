"use client";

import type { SfPaymentDue } from "@/lib/salesforce";
import { formatDate, formatINR } from "@/lib/format";
import { usePaymentWatch, WaitingFooter } from "@/lib/usePaymentWatch";
import UpiPayCard from "@/components/UpiPayCard";
import PaymentSuccess from "@/components/PaymentSuccess";

/**
 * Shown in place of the checkout form when Salesforce reports a delivered
 * order that has gone unpaid past the limit. Once the payment is recorded
 * in Salesforce the panel switches to the thank-you screen by itself.
 */
export default function PaymentDueBlock({
  due,
  onRecheck,
  onCleared,
}: {
  due: SfPaymentDue;
  /** Ask Salesforce again; true when nothing is owed any more. */
  onRecheck: () => Promise<boolean>;
  /** Customer acknowledged the "payment received" screen; show the form. */
  onCleared: () => void;
}) {
  const { paid, checking, stillDue, recheck } = usePaymentWatch(onRecheck);
  const orderNames = due.overdue.map((o) => o.saleName).join(", ");

  if (paid) {
    return (
      <PaymentSuccess
        message={
          <>
            Thank you! We have recorded {formatINR(due.totalDue)} against{" "}
            {orderNames}. A WhatsApp confirmation is on its way to you.
          </>
        }
      >
        <button
          type="button"
          onClick={onCleared}
          className="h-12 w-full rounded-full bg-pine font-semibold text-mist hover:bg-pine-dark"
        >
          Continue to place your order
        </button>
      </PaymentSuccess>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-pine/40 shadow-card p-5 sm:p-7">
      {/* Phones: details, QR, then the waiting note. Wider screens: details
          with the waiting note just under them on the left, the QR on the right,
          so nothing needs scrolling past. */}
      <div className="grid gap-6 md:grid-cols-2 md:grid-rows-[auto_1fr] md:gap-x-10">
        <div className="md:col-start-1 md:row-start-1">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-pine-dark">
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
                <span className="font-semibold text-pine-dark shrink-0">
                  {formatINR(o.balanceDue)}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between px-4 py-2.5 font-bold">
              <span>Total to pay</span>
              <span>{formatINR(due.totalDue)}</span>
            </li>
          </ul>
        </div>

        <div className="md:col-start-2 md:row-start-1 md:row-span-2">
          <UpiPayCard amount={due.totalDue} orderNames={orderNames} />
        </div>

        <div className="md:col-start-1 md:row-start-2">
          <WaitingFooter checking={checking} stillDue={stillDue} onRecheck={() => void recheck()} />
        </div>
      </div>
    </div>
  );
}
