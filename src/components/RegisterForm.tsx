"use client";

import { useMemo, useState } from "react";
import { INDIAN_STATES, citiesFor } from "@/lib/india";

export interface RegisteredAccount {
  accountName: string | null;
  code: string;
  alreadyRegistered: boolean;
}

const field =
  "mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-terra";
const label = "block text-sm font-semibold";

export default function RegisterForm({
  initialPhone = "",
  onRegistered,
}: {
  initialPhone?: string;
  onRegistered: (account: RegisteredAccount) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState("");
  const [locality, setLocality] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cities = useMemo(() => citiesFor(state), [state]);

  const canSubmit =
    name.trim() !== "" &&
    phone.length === 10 &&
    locality.trim() !== "" &&
    state !== "" &&
    city !== "" &&
    /^[1-9][0-9]{5}$/.test(pincode);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address,
          locality,
          city,
          state,
          pincode,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed.");
      onRegistered({
        accountName: json.accountName ?? null,
        code: json.code,
        alreadyRegistered: Boolean(json.alreadyRegistered),
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
      <div className="max-h-[55vh] overflow-y-auto pr-1">
        <label className={label} htmlFor="rg-name">
          Name *
        </label>
        <input
          id="rg-name"
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your shop or your name"
          required
        />

        <label className={`${label} mt-4`} htmlFor="rg-phone">
          WhatsApp number *
        </label>
        <div className="mt-1.5 flex gap-2">
          <span className="flex h-12 items-center rounded-xl border border-line bg-cream-2 px-3 text-sm font-semibold text-ink-soft">
            +91
          </span>
          <input
            id="rg-phone"
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

        <label className={`${label} mt-4`} htmlFor="rg-address">
          Address <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <input
          id="rg-address"
          className={field}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Shop no., building, street"
        />

        <label className={`${label} mt-4`} htmlFor="rg-locality">
          Locality *
        </label>
        <input
          id="rg-locality"
          className={field}
          value={locality}
          onChange={(e) => setLocality(e.target.value)}
          placeholder="Area or neighbourhood"
          required
        />

        <label className={`${label} mt-4`} htmlFor="rg-state">
          State *
        </label>
        <select
          id="rg-state"
          className={field}
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setCity(""); // the old city belongs to the old state
          }}
          required
        >
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className={`${label} mt-4`} htmlFor="rg-city">
          City *
        </label>
        <select
          id="rg-city"
          className={field}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={!state}
          required
        >
          <option value="">
            {state ? "Select city" : "Choose a state first"}
          </option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className={`${label} mt-4`} htmlFor="rg-pin">
          PIN code *
        </label>
        <input
          id="rg-pin"
          inputMode="numeric"
          className={field}
          value={pincode}
          onChange={(e) =>
            setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="6-digit PIN"
          required
        />
      </div>

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="mt-4 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
      >
        {busy ? "Registering…" : "Register"}
      </button>
      <p className="mt-2 text-center text-xs text-ink-soft">
        We&apos;ll send your business code to this WhatsApp number.
      </p>

      {error && (
        <p className="mt-3 rounded-xl border border-terra/30 bg-terra/10 px-4 py-2.5 text-sm text-terra-dark">
          {error}
        </p>
      )}
    </form>
  );
}
