/**
 * Cashfree Verification Suite — GSTIN lookup.
 *
 * Request/response shape follows Cashfree's public GSTIN Verification docs
 * (docs.cashfree.com/secure-id/know-your-business/verify-gstin). Access to
 * this suite is gated behind a Cashfree sales conversation rather than
 * self-serve signup, so the exact field names below should be checked
 * against a real sandbox response once API keys are issued — pickString()
 * below tries a couple of likely spellings for that reason.
 */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const BASE_URL =
  process.env.CASHFREE_VERIFICATION_BASE_URL ?? "https://api.cashfree.com/api/v2";

export function cashfreeConfigured(): boolean {
  return Boolean(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET);
}

export interface CashfreeGstinAddress {
  line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface CashfreeGstinLookup {
  /** True only for a clean, parseable, successful verification. */
  ok: boolean;
  gstin: string;
  registrationStatus: string | null;
  legalName: string | null;
  tradeName: string | null;
  address: CashfreeGstinAddress | null;
  constitution: string | null;
  errorReason?:
    | "invalid_format"
    | "not_configured"
    | "not_found"
    | "http_error"
    | "network_error"
    | "unexpected_shape";
  errorMessage?: string;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function blank(gstin: string, reason: CashfreeGstinLookup["errorReason"], message: string): CashfreeGstinLookup {
  return {
    ok: false,
    gstin,
    registrationStatus: null,
    legalName: null,
    tradeName: null,
    address: null,
    constitution: null,
    errorReason: reason,
    errorMessage: message,
  };
}

export async function verifyGstinWithCashfree(gstinRaw: string): Promise<CashfreeGstinLookup> {
  const gstin = gstinRaw.trim().toUpperCase();

  if (!GSTIN_RE.test(gstin)) {
    return blank(gstin, "invalid_format", "That doesn't look like a valid 15-character GSTIN.");
  }
  if (!cashfreeConfigured()) {
    return blank(gstin, "not_configured", "GSTIN verification isn't set up yet.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/verification/gstin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": process.env.CASHFREE_CLIENT_ID!,
        "X-Client-Secret": process.env.CASHFREE_CLIENT_SECRET!,
      },
      body: JSON.stringify({ gstin }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return blank(gstin, "network_error", "Couldn't reach the verification service.");
  } finally {
    clearTimeout(timeout);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return blank(gstin, "unexpected_shape", "The verification service returned something unexpected.");
  }

  if (!res.ok) {
    const message =
      (json as { message?: string } | null)?.message ?? `Verification failed (${res.status}).`;
    return blank(gstin, res.status === 404 ? "not_found" : "http_error", message);
  }

  const root = json as Record<string, unknown>;
  const data = (root.data as Record<string, unknown> | undefined) ?? root;

  const legalName = pickString(data, ["legal_name", "legalName"]);
  const tradeName = pickString(data, ["trade_name", "tradeName"]);
  const registrationStatus = pickString(data, [
    "registration_status",
    "registrationStatus",
    "gstin_status",
    "status",
  ]);
  const constitution = pickString(data, ["constitution_of_business", "business_type"]);

  const addrRaw =
    (data.registered_address as Record<string, unknown> | undefined) ??
    (data.address as Record<string, unknown> | undefined);
  const address: CashfreeGstinAddress | null = addrRaw
    ? {
        line1: pickString(addrRaw, ["address", "line1", "building"]),
        city: pickString(addrRaw, ["city"]),
        state: pickString(addrRaw, ["state"]),
        pincode: pickString(addrRaw, ["pincode", "pin_code"]),
      }
    : null;

  if (!legalName) {
    return {
      ok: false,
      gstin,
      registrationStatus,
      legalName,
      tradeName,
      address,
      constitution,
      errorReason: "unexpected_shape",
      errorMessage: "Couldn't read the verification result.",
    };
  }

  const isActive = (registrationStatus ?? "").toLowerCase() === "active";
  if (!isActive) {
    return {
      ok: false,
      gstin,
      registrationStatus,
      legalName,
      tradeName,
      address,
      constitution,
      errorReason: "not_found",
      errorMessage: `This GSTIN is registered but marked "${registrationStatus ?? "not active"}" with the GST department.`,
    };
  }

  return { ok: true, gstin, registrationStatus, legalName, tradeName, address, constitution };
}
