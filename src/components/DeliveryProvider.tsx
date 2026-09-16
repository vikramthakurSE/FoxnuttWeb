"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DeliveryRules, DeliveryZone, PincodeLocation } from "@/lib/delivery";

/**
 * The buyer's delivery PIN code, shared by the header chip, the cart and
 * checkout. Remembered in this browser only; checkout re-resolves it and
 * the order API checks it again before anything reaches Salesforce.
 */

export interface ResolvedPincode {
  location: PincodeLocation;
  zone: DeliveryZone;
  rules: DeliveryRules;
}

interface DeliveryContextValue {
  pin: ResolvedPincode | null;
  ready: boolean;
  /** Resolve and remember a PIN code. Resolves to an error message, or null on success. */
  setPincode: (pincode: string) => Promise<string | null>;
  clearPincode: () => void;
}

const DeliveryContext = createContext<DeliveryContextValue | null>(null);
const STORAGE_KEY = "nn_pincode_v2";

export async function resolvePincode(
  pincode: string
): Promise<ResolvedPincode | { error: string }> {
  try {
    const res = await fetch(`/api/pincode?pin=${encodeURIComponent(pincode)}`);
    const json = await res.json();
    if (!res.ok || !json.found) {
      return { error: json.error ?? "We couldn't find this PIN code. Please check it." };
    }
    return { location: json.location, zone: json.zone, rules: json.rules };
  } catch {
    return { error: "Couldn't check the PIN code. Please try again." };
  }
}

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const [pin, setPin] = useState<ResolvedPincode | null>(null);
  const [ready, setReady] = useState(false);

  // Show the saved PIN code straight away, then re-resolve it so a change
  // to the delivery settings shows up without the buyer re-entering it.
  useEffect(() => {
    let saved: ResolvedPincode | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as ResolvedPincode;
    } catch {
      /* storage blocked or corrupted */
    }
    if (!saved?.location?.pincode) {
      setReady(true);
      return;
    }
    setPin(saved);
    setReady(true);
    void resolvePincode(saved.location.pincode).then((r) => {
      if (!("error" in r)) setPin(r);
    });
  }, []);

  const setPincode = useCallback(async (pincode: string) => {
    const r = await resolvePincode(pincode);
    if ("error" in r) return r.error;
    setPin(r);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    } catch {
      /* private mode etc. */
    }
    return null;
  }, []);

  const clearPincode = useCallback(() => {
    setPin(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ pin, ready, setPincode, clearPincode }),
    [pin, ready, setPincode, clearPincode]
  );
  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}

export function useDelivery(): DeliveryContextValue {
  const ctx = useContext(DeliveryContext);
  if (!ctx) throw new Error("useDelivery must be used inside DeliveryProvider");
  return ctx;
}
