"use client";

import { useEffect, useRef, useState } from "react";
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
  onCleared,
}: {
  due: SfPaymentDue;
  /** Ask Salesforce again; true when nothing is owed any more. */
  onRecheck: () => Promise<boolean>;
  /** Customer acknowledged the "payment received" screen; show the form. */
  onCleared: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [stillDue, setStillDue] = useState(false);
  const [paid, setPaid] = useState(false);
  const [qrMissing, setQrMissing] = useState(false);
  // Guards against overlapping checks when a manual click lands while the
  // background poll is mid-flight.
  const inFlight = useRef(false);
  const paidRef = useRef(false);

  // Watch for the payment by itself. The bank alert reaches Salesforce a
  // minute or so after the customer pays, so the page asks every few
  // seconds while it is visible and switches to the thank-you screen on
  // its own. Stops after a while so an abandoned tab does not poll forever.
  useEffect(() => {
    if (paid) return;
    const EVERY_MS = 6000;
    const GIVE_UP_MS = 30 * 60 * 1000;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (paidRef.current || Date.now() - started > GIVE_UP_MS) return;
      if (document.visibilityState === "visible" && !inFlight.current) {
        inFlight.current = true;
        try {
          if (await onRecheck()) {
            paidRef.current = true;
            setPaid(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
        } catch {
          // transient; try again next tick
        } finally {
          inFlight.current = false;
        }
      }
      timer = setTimeout(tick, EVERY_MS);
    };
    timer = setTimeout(tick, EVERY_MS);

    // Coming back from the UPI app is the moment the payment most likely
    // just happened, so check immediately rather than waiting a tick.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [paid, onRecheck]);

  // Defaults decoded from the PhonePe QR in public/pay; env vars override
  // them if the account ever changes.
  const vpa = process.env.NEXT_PUBLIC_UPI_VPA || "9620405311-4@ybl";
  const payee = process.env.NEXT_PUBLIC_UPI_PAYEE || "VIKRAM KUMAR";
  const orderNames = due.overdue.map((o) => o.saleName).join(", ");
  // Amount and order number are pre-filled, so on a phone the customer
  // taps once and confirms in their UPI app. The remark is kept short
  // because Axis truncates it in the credit alert anyway.
  const upiLink =
    `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payee)}` +
    `&am=${due.totalDue.toFixed(2)}&cu=INR` +
    `&tn=${encodeURIComponent(orderNames.slice(0, 40))}`;

  async function recheck() {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    setStillDue(false);
    try {
      const cleared = await onRecheck();
      if (cleared) {
        paidRef.current = true;
        setPaid(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setStillDue(true);
      }
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }

  if (paid) {
    return (
      <div className="nn-pop mt-6 rounded-2xl bg-card border border-leaf/40 shadow-card p-6 text-center">
        <div className="relative mx-auto h-24 w-24">
          <span className="nn-ring absolute inset-0 rounded-full bg-leaf/20" />
          <span className="nn-ring nn-ring-2 absolute inset-0 rounded-full bg-leaf/15" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-leaf text-cream shadow-card">
            <svg viewBox="0 0 52 52" className="h-12 w-12" aria-hidden="true">
              <path
                className="nn-tick"
                d="M14 27 L23 35 L39 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <h2 className="nn-rise mt-5 font-display text-2xl font-bold text-leaf">
          Payment received
        </h2>
        <p className="nn-rise nn-delay-1 mt-2 text-sm text-ink-soft">
          Thank you! We have recorded {formatINR(due.totalDue)} against{" "}
          {orderNames}. A WhatsApp confirmation is on its way to you.
        </p>
        <button
          type="button"
          onClick={onCleared}
          className="nn-rise nn-delay-2 mt-6 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark"
        >
          Continue to place your order
        </button>
        <style>{`
          @keyframes nn-pop { 0% { opacity: 0; transform: scale(.94) translateY(8px); } 100% { opacity: 1; transform: none; } }
          @keyframes nn-tick { to { stroke-dashoffset: 0; } }
          @keyframes nn-ring { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(1.9); opacity: 0; } }
          @keyframes nn-rise { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: none; } }
          .nn-pop { animation: nn-pop .45s cubic-bezier(.2,.8,.2,1) both; }
          .nn-tick { stroke-dasharray: 48; stroke-dashoffset: 48; animation: nn-tick .5s ease-out .35s forwards; }
          .nn-ring { animation: nn-ring 1.4s ease-out .3s infinite; }
          .nn-ring-2 { animation-delay: .8s; }
          .nn-rise { animation: nn-rise .4s ease-out both; animation-delay: .5s; }
          .nn-delay-1 { animation-delay: .65s; }
          .nn-delay-2 { animation-delay: .8s; }
          @media (prefers-reduced-motion: reduce) {
            .nn-pop, .nn-tick, .nn-ring, .nn-rise { animation: none; }
            .nn-tick { stroke-dashoffset: 0; }
            .nn-ring { display: none; }
          }
        `}</style>
      </div>
    );
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
        <a
          href={upiLink}
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-terra px-6 text-sm font-semibold text-cream hover:bg-terra-dark"
        >
          Pay {formatINR(due.totalDue)} in UPI app
        </a>
        <p className="mt-1 text-[11px] text-ink-soft">
          Works on phones with a UPI app installed
        </p>
        <p className="mt-3 text-xs text-ink-soft">
          Please mention your order number ({orderNames}) in the payment
          remark. You will get a WhatsApp confirmation once we record it.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-soft">
        <span className="nn-dot inline-block h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
        Waiting for your payment — this page updates by itself once it arrives.
      </div>
      <button
        type="button"
        onClick={() => void recheck()}
        disabled={checking}
        className="mt-3 h-12 w-full rounded-full border border-ink/20 font-semibold hover:bg-cream-2 disabled:opacity-50"
      >
        {checking ? "Checking…" : "I have paid — check now"}
      </button>
      <style>{`
        @keyframes nn-dot { 0%, 100% { opacity: .35; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
        .nn-dot { animation: nn-dot 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .nn-dot { animation: none; } }
      `}</style>
      {stillDue && (
        <p className="mt-2 text-center text-xs text-ink-soft">
          Not received yet. Bank confirmations usually reach us within a
          minute or two of paying; we will keep checking, and you will also
          get a WhatsApp message as soon as it is recorded.
        </p>
      )}
    </div>
  );
}
