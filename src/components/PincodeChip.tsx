"use client";

import { useEffect, useRef, useState } from "react";
import { useDelivery } from "./DeliveryProvider";
import { placeLabel, titleCase, zoneSummary } from "@/lib/delivery";
import Spinner from "./Spinner";

const PROMPTED_KEY = "nn_pincode_prompted_v1";

/**
 * "Deliver to" chip in the header. Asks for the PIN code once on a first
 * visit, so delivery rules show up in the cart before checkout.
 */
export default function PincodeChip() {
  const { pin, ready, setPincode } = useDelivery();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // First visit with no PIN code: open the prompt once.
  useEffect(() => {
    if (!ready || pin) return;
    // The header mounts a chip for desktop and one for mobile; only the
    // visible one may claim the one-time prompt.
    if (!wrapRef.current?.offsetParent) return;
    let prompted = true;
    try {
      prompted = localStorage.getItem(PROMPTED_KEY) === "1";
      localStorage.setItem(PROMPTED_KEY, "1");
    } catch {
      /* storage blocked: never auto-open */
    }
    if (prompted) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [ready, pin]);

  useEffect(() => {
    if (!open) return;
    setValue(pin?.location.pincode ?? "");
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // Only reset the field when the popover opens.
  }, [open]);

  async function submit() {
    if (value.length !== 6) {
      setError("Enter a 6-digit PIN code.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await setPincode(value);
    setBusy(false);
    if (err) setError(err);
    else setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={pin ? `Delivering to ${placeLabel(pin.location)}` : "Enter your delivery PIN code"}
        className={`flex h-10 items-center gap-1.5 rounded-full border px-2.5 text-left transition-colors sm:px-3 ${
          pin
            ? "border-line bg-card text-ink hover:bg-mist-2"
            : "border-pine/40 bg-pine/5 text-pine hover:bg-pine/10"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-pine">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {pin ? (
          <span className="leading-tight">
            <span className="hidden text-[10px] text-ink-soft lg:block">Deliver to</span>
            <span className="block text-sm font-semibold">
              {pin.location.pincode}
              <span className="hidden font-normal text-ink-soft lg:inline">
                {" "}· {titleCase(pin.location.districts[0] ?? "")}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-sm font-semibold">
            <span className="sm:hidden">PIN</span>
            <span className="hidden sm:inline">Enter PIN code</span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Delivery PIN code"
          className="fixed left-3 right-3 top-[70px] z-50 rounded-2xl border border-line bg-card p-4 shadow-[0_24px_48px_-20px_rgba(27,42,33,.45)] sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-80"
        >
          <p className="font-display text-lg font-bold">Where should we deliver?</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Any order size in Bangalore. Outside Bangalore, each brand has a minimum weight.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input
              ref={inputRef}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="6-digit PIN code"
              aria-label="PIN code"
              value={value}
              onChange={(e) => {
                setValue(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 tracking-widest outline-none focus:border-pine"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-11 rounded-xl bg-pine px-4 text-sm font-semibold text-mist hover:bg-pine-dark disabled:opacity-60"
            >
              {busy ? <Spinner size={16} /> : "Check"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          {pin && !error && (
            <div className="mt-3 rounded-xl bg-mist-2 px-3 py-2 text-sm">
              <p className="font-semibold">{placeLabel(pin.location)}</p>
              <p className="text-xs text-ink-soft">{zoneSummary(pin.rules, pin.zone)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
