"use client";

import { useState } from "react";

/**
 * "I've lost my code" — the client gives the number we already have on file
 * and Salesforce WhatsApps the code to it. The code is never shown on screen:
 * anyone could otherwise type a number they don't own and read it back.
 */
export default function RequestCode({
  onNotRegistered,
  onBack,
}: {
  onNotRegistered: (phone: string) => void;
  onBack: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send your code.");
      if (json.registered) setSent(true);
      else onNotRegistered(phone);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-leaf/15 text-2xl">
          ✓
        </div>
        <p className="mt-3 font-semibold">Code sent</p>
        <p className="mt-1 text-sm text-ink-soft">
          Check WhatsApp on <span className="font-semibold">+91 {phone}</span> —
          your business code is in the message.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark"
        >
          Enter my code
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="rc-phone">
        Registered mobile number
      </label>
      <div className="mt-1.5 flex gap-2">
        <span className="flex h-12 items-center rounded-xl border border-line bg-cream-2 px-3 text-sm font-semibold text-ink-soft">
          +91
        </span>
        <input
          id="rc-phone"
          type="tel"
          inputMode="numeric"
          className="h-12 flex-1 rounded-xl border border-line bg-card px-4 outline-none focus:border-terra"
          value={phone}
          onChange={(e) =>
            setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
          }
          placeholder="10-digit number"
          required
        />
      </div>
      <button
        type="submit"
        disabled={busy || phone.length !== 10}
        className="mt-3 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
      >
        {busy ? "Checking…" : "Send my code on WhatsApp"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 w-full text-sm font-semibold text-ink-soft hover:text-ink"
      >
        Back to login
      </button>

      {error && (
        <p className="mt-3 rounded-xl border border-terra/30 bg-terra/10 px-4 py-2.5 text-sm text-terra-dark">
          {error}
        </p>
      )}
    </form>
  );
}
