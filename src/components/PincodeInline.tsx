"use client";

import { useState } from "react";
import { useDelivery } from "./DeliveryProvider";
import Spinner from "./Spinner";

/** Compact PIN code entry for the cart when the header chip is still empty. */
export default function PincodeInline() {
  const { setPincode } = useDelivery();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="rounded-xl border border-pine/30 bg-pine/5 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (value.length !== 6) return setError("Enter a 6-digit PIN code.");
        setBusy(true);
        setError(await setPincode(value));
        setBusy(false);
      }}
    >
      <label htmlFor="nn-cart-pin" className="block text-sm font-semibold">
        Delivery PIN code
      </label>
      <p className="text-xs text-ink-soft">To check the minimum order and delivery charge.</p>
      <div className="mt-2 flex gap-2">
        <input
          id="nn-cart-pin"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="e.g. 560001"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, "").slice(0, 6));
            setError(null);
          }}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 tracking-widest outline-none focus:border-pine"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-xl bg-pine px-4 text-sm font-semibold text-mist hover:bg-pine-dark disabled:opacity-60"
        >
          {busy ? <Spinner size={16} /> : "Check"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </form>
  );
}
