"use client";

import { useRef, useState } from "react";

export interface VerifiedCustomer {
  name: string | null;
  business_name: string | null;
  address: string | null;
  gstin: string | null;
}

/**
 * Two-step phone → WhatsApp OTP verification.
 * Calls onVerified with the normalized phone and any saved customer profile.
 */
export default function PhoneVerify({
  onVerified,
}: {
  onVerified: (phone: string, customer: VerifiedCustomer | null) => void;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send the code.");
      setDevCode(json.devCode ?? null); // demo mode only
      setStep("code");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Verification failed.");
      onVerified(json.phone as string, json.customer ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void requestCode();
          }}
        >
          <label className="block text-sm font-semibold" htmlFor="nn-phone">
            WhatsApp mobile number
          </label>
          <div className="mt-1.5 flex gap-2">
            <span className="flex h-12 items-center rounded-xl border border-line bg-cream-2 px-3 text-sm font-semibold text-ink-soft">
              +91
            </span>
            <input
              id="nn-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))}
              className="h-12 flex-1 rounded-xl border border-line bg-card px-4 outline-none focus:border-terra"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send code on WhatsApp"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode();
          }}
        >
          <p className="text-sm text-ink-soft">
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-ink">+91 {phone}</span> on
            WhatsApp.{" "}
            <button
              type="button"
              className="font-semibold text-terra hover:underline"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
            >
              Change
            </button>
          </p>
          {devCode && (
            <p className="mt-3 rounded-xl bg-gold/10 border border-gold/40 px-4 py-2.5 text-sm">
              <span className="font-semibold">Demo mode</span> — no WhatsApp
              sent. Your code is{" "}
              <span className="font-bold tracking-widest">{devCode}</span>
            </p>
          )}
          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-3 h-12 w-full rounded-xl border border-line bg-card px-4 text-center text-xl tracking-[0.4em] outline-none focus:border-terra"
            required
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="mt-3 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestCode()}
            className="mt-2 w-full text-sm font-semibold text-ink-soft hover:text-ink"
          >
            Resend code
          </button>
        </form>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-terra/10 border border-terra/30 px-4 py-2.5 text-sm text-terra-dark">
          {error}
        </p>
      )}
    </div>
  );
}
