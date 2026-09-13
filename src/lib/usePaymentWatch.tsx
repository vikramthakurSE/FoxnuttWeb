"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Polls `check` while the page is visible until it reports the payment as
 * received. The bank alert reaches Salesforce a minute or so after the
 * customer pays, so ask every few seconds, immediately on returning from
 * the UPI app, and give up after a while so an abandoned tab stops.
 */
export function usePaymentWatch(check: () => Promise<boolean>) {
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stillDue, setStillDue] = useState(false);
  const inFlight = useRef(false);
  const paidRef = useRef(false);

  const markPaid = useCallback(() => {
    paidRef.current = true;
    setPaid(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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
          if (await check()) {
            markPaid();
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
  }, [paid, check, markPaid]);

  /** Manual "I have paid" button. */
  const recheck = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    setStillDue(false);
    try {
      if (await check()) markPaid();
      else setStillDue(true);
    } catch {
      setStillDue(true);
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, [check, markPaid]);

  return { paid, checking, stillDue, recheck };
}

/** The "waiting" footer shared by both payment panels. */
export function WaitingFooter({
  checking,
  stillDue,
  onRecheck,
}: {
  checking: boolean;
  stillDue: boolean;
  onRecheck: () => void;
}) {
  return (
    <>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-soft">
        <span className="nn-dot inline-block h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
        Waiting for your payment — this page updates by itself once it arrives.
      </div>
      <button
        type="button"
        onClick={onRecheck}
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
    </>
  );
}
