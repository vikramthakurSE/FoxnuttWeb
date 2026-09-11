"use client";

import { useState } from "react";

export interface GstinVerifyResult {
  verified: boolean;
  gstin: string;
  status: string | null;
  legalName: string | null;
  tradeName: string | null;
  address: {
    line1: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  } | null;
  message: string;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * GSTIN entry + verify button for checkout. Reports every attempt upward
 * via onResolved — including a failed/unconfirmed one — because a failure
 * here is a soft block: the order can still go through, just flagged for
 * manual review, so the parent only needs to know "an attempt was made."
 */
export default function GstinVerify({
  phone,
  onResolved,
}: {
  phone: string;
  onResolved: (result: GstinVerifyResult | null) => void;
}) {
  const [gstin, setGstin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GstinVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/gstin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstin, phone }),
      });
      const json = (await res.json()) as GstinVerifyResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not verify right now.");
      setResult(json);
      onResolved(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function editGstin(value: string) {
    setGstin(value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15));
    if (result) {
      // A changed GSTIN invalidates the last result — re-verify before it
      // counts again.
      setResult(null);
      onResolved(null);
    }
  }

  if (result?.verified) {
    return (
      <div className="mt-4 rounded-xl border border-leaf/40 bg-leaf/10 px-4 py-3 text-sm">
        <p className="font-semibold text-ink">✓ Business verified — {result.gstin}</p>
        <p className="mt-1 text-ink-soft">{result.legalName}</p>
        {result.tradeName && result.tradeName !== result.legalName && (
          <p className="text-ink-soft">Trading as {result.tradeName}</p>
        )}
        {result.address && (
          <p className="text-ink-soft">
            {[result.address.line1, result.address.city, result.address.state, result.address.pincode]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setResult(null);
            onResolved(null);
          }}
          className="mt-2 text-xs font-semibold text-terra hover:underline"
        >
          Not your business? Change GSTIN
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <label className="block text-sm font-semibold" htmlFor="nn-gstin">
        GSTIN *
      </label>
      <p className="mt-1 mb-1.5 text-xs text-ink-soft">
        We verify every new business account before its first order.
      </p>
      <div className="flex gap-2">
        <input
          id="nn-gstin"
          value={gstin}
          onChange={(e) => editGstin(e.target.value)}
          maxLength={15}
          placeholder="e.g. 22AAAAA0000A1Z5"
          className="h-12 flex-1 rounded-xl border border-line bg-card px-4 font-mono text-sm tracking-wide outline-none focus:border-terra"
        />
        <button
          type="button"
          disabled={busy || !GSTIN_RE.test(gstin)}
          onClick={() => void verify()}
          className="h-12 shrink-0 rounded-xl bg-terra px-5 font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
        >
          {busy ? "Checking…" : "Verify"}
        </button>
      </div>

      {result && !result.verified && (
        <p className="mt-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm">
          {result.message} Your order will still go through — we&apos;ll confirm your
          business details before it&apos;s confirmed.
        </p>
      )}
      {error && (
        <p className="mt-2 rounded-xl border border-terra/30 bg-terra/10 px-4 py-2.5 text-sm text-terra-dark">
          {error}
        </p>
      )}
    </div>
  );
}
