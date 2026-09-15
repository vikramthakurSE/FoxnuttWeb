"use client";

import { useCallback, useState } from "react";
import { formatINR } from "@/lib/format";
import { usePaymentWatch, WaitingFooter } from "@/lib/usePaymentWatch";
import UpiPayCard from "@/components/UpiPayCard";
import PaymentSuccess from "@/components/PaymentSuccess";

/**
 * Pay some or all of the balance on one of the customer's own orders, from
 * the orders page. Works for any order with money owed — online or COD,
 * Confirmed or already Delivered — not only the "pay right after checkout"
 * case OnlinePaymentPanel handles.
 *
 * Success is "this order's balance has dropped since I opened this panel",
 * not an exact-amount match: the bank alert booking already splits a
 * payment correctly against whichever order the customer names in the UPI
 * remark (see AxisCreditAlertHandler), so watching the balance itself is
 * simpler and cannot drift out of sync with how that booking actually
 * works.
 */
export default function PayDuePanel({
  saleId,
  saleName,
  balanceDue,
  onPaid,
  onCancel,
  compact = false,
}: {
  saleId: string;
  saleName: string;
  balanceDue: number;
  onPaid: () => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const [step, setStep] = useState<"amount" | "pay">("amount");
  const [amountText, setAmountText] = useState(String(balanceDue));
  // Frozen the moment the customer commits to an amount, so a later re-poll
  // of the order list (which re-renders this panel with a fresh balanceDue
  // prop) cannot reset what "paid" is being measured against.
  const [startingBalance, setStartingBalance] = useState(balanceDue);

  const check = useCallback(async () => {
    const res = await fetch(
      `/api/orders/balance?saleId=${encodeURIComponent(saleId)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return false;
    const d = (await res.json()) as { found: boolean; balanceDue?: number };
    return d.found && d.balanceDue != null && d.balanceDue < startingBalance;
  }, [saleId, startingBalance]);

  const { paid, checking, stillDue, recheck } = usePaymentWatch(check);

  const amount = Number(amountText);
  const validAmount =
    Number.isFinite(amount) && amount > 0 && amount <= balanceDue;

  if (paid) {
    return (
      <PaymentSuccess
        title="Payment received, thank you!"
        message={
          <>
            Recorded against {saleName}. A WhatsApp confirmation is on its
            way.
          </>
        }
      >
        <button
          type="button"
          onClick={onPaid}
          className={`rounded-full bg-pine font-semibold text-mist hover:bg-pine-dark ${
            compact ? "h-11 text-sm" : "h-12"
          }`}
        >
          Done
        </button>
      </PaymentSuccess>
    );
  }

  if (step === "amount") {
    return (
      <div className="mt-3 rounded-xl border border-line bg-mist-2 p-3">
        <p className="text-sm font-semibold">
          Pay towards {saleName}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          Balance due {formatINR(balanceDue)}. Pay all of it, or enter a
          smaller amount.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="flex h-11 items-center rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink-soft">
            ₹
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={balanceDue}
            step="1"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="h-11 flex-1 rounded-lg border border-line bg-card px-3 text-sm font-semibold outline-none focus:border-pine"
          />
          <button
            type="button"
            onClick={() => setAmountText(String(balanceDue))}
            className="h-11 shrink-0 rounded-lg border border-line px-3 text-xs font-semibold text-ink-soft hover:bg-card"
          >
            Full amount
          </button>
        </div>
        {!validAmount && amountText !== "" && (
          <p className="mt-1.5 text-xs text-danger">
            Enter an amount between ₹1 and {formatINR(balanceDue)}.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={!validAmount}
            onClick={() => {
              setStartingBalance(balanceDue);
              setStep("pay");
            }}
            className="h-11 flex-1 rounded-full bg-pine text-sm font-semibold text-mist hover:bg-pine-dark disabled:opacity-50"
          >
            Continue to pay {validAmount ? formatINR(amount) : ""}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-full border border-line px-4 text-sm font-semibold hover:bg-card"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-gold/50 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Paying {formatINR(amount)} towards {saleName}
        </p>
        <button
          type="button"
          onClick={() => setStep("amount")}
          className="shrink-0 text-xs font-semibold text-ink-soft hover:text-ink"
        >
          Change amount
        </button>
      </div>

      <div className="mt-3">
        <UpiPayCard amount={amount} orderNames={saleName} />
      </div>

      <WaitingFooter
        checking={checking}
        stillDue={stillDue}
        onRecheck={() => void recheck()}
      />
    </div>
  );
}
