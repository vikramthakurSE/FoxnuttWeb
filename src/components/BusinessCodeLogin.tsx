"use client";

import { useState } from "react";

export interface LoggedInAccount {
  accountName: string | null;
  code: string;
  address: string | null;
  gstin: string | null;
  gstinVerified: boolean;
  gstinLegalName: string | null;
  gstinTradeName: string | null;
  gstinStatus: string | null;
}

/**
 * Business-code login. The code is printed in the client's welcome message
 * on WhatsApp; they never create a password or an account here.
 */
export default function BusinessCodeLogin({
  onLoggedIn,
  compact = false,
}: {
  onLoggedIn: (account: LoggedInAccount) => void;
  compact?: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Login failed.");
      onLoggedIn({
        accountName: json.accountName ?? null,
        code: json.code,
        address: json.address ?? null,
        gstin: json.gstin ?? null,
        gstinVerified: Boolean(json.gstinVerified),
        gstinLegalName: json.gstinLegalName ?? null,
        gstinTradeName: json.gstinTradeName ?? null,
        gstinStatus: json.gstinStatus ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {!compact && (
        <label className="block text-sm font-semibold" htmlFor="nn-code">
          Business code
        </label>
      )}
      <input
        id="nn-code"
        type="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="e.g. PRI98364"
        value={code}
        onChange={(e) =>
          setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
        }
        maxLength={20}
        className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-4 text-center text-lg font-semibold tracking-[0.2em] outline-none focus:border-terra"
        required
      />
      <button
        type="submit"
        disabled={busy || code.length < 8}
        className="mt-3 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
      >
        {busy ? "Checking…" : "Continue"}
      </button>
      <p className="mt-2 text-center text-xs text-ink-soft">
        Your code is in the welcome message we sent you on WhatsApp.
      </p>
      {error && (
        <p className="mt-3 rounded-xl border border-terra/30 bg-terra/10 px-4 py-2.5 text-sm text-terra-dark">
          {error}
        </p>
      )}
    </form>
  );
}
