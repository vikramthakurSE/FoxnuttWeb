import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
import { verifyGstinWithCashfree } from "@/lib/cashfree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Strip to the last 10 digits, mirroring lib/session normalizePhone. */
function tidyPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^0-9]/g, "");
  if (d.length > 10) d = d.slice(-10);
  return d.length === 10 ? d : null;
}

// Every attempt is reported back as 200 (verified: true/false) — a failed
// or unconfirmed GSTIN is a soft block, not a request error, so the
// checkout UI can render it as an outcome rather than catch it as a fault.
export async function POST(req: NextRequest) {
  let body: { gstin?: string; phone?: string };
  try {
    body = (await req.json()) as { gstin?: string; phone?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const phone = tidyPhone(body.phone);
  const gstinInput = (body.gstin ?? "").trim();
  if (!phone) {
    return NextResponse.json({ error: "Missing phone number." }, { status: 400 });
  }
  if (!gstinInput) {
    return NextResponse.json({ error: "Enter a GSTIN first." }, { status: 400 });
  }

  const lookup = await verifyGstinWithCashfree(gstinInput);

  if (lookup.ok && hasDb()) {
    try {
      const db = sql();
      await db`
        INSERT INTO customers (
          phone, gstin, gstin_verified, gstin_status,
          gstin_legal_name, gstin_trade_name, gstin_address, gstin_verified_at
        )
        VALUES (
          ${phone}, ${lookup.gstin}, true, ${lookup.registrationStatus},
          ${lookup.legalName}, ${lookup.tradeName},
          ${db.json(lookup.address as unknown as Parameters<typeof db.json>[0])}, now()
        )
        ON CONFLICT (phone) DO UPDATE SET
          gstin              = EXCLUDED.gstin,
          gstin_verified     = true,
          gstin_status       = EXCLUDED.gstin_status,
          gstin_legal_name   = EXCLUDED.gstin_legal_name,
          gstin_trade_name   = EXCLUDED.gstin_trade_name,
          gstin_address      = EXCLUDED.gstin_address,
          gstin_verified_at  = now()
      `;
    } catch (e) {
      console.error("gstin/verify: failed to persist verified customer:", e);
    }
  }

  return NextResponse.json({
    verified: lookup.ok,
    gstin: lookup.gstin,
    status: lookup.registrationStatus,
    legalName: lookup.legalName,
    tradeName: lookup.tradeName,
    address: lookup.address,
    message: lookup.ok
      ? "Verified"
      : lookup.errorMessage ?? "We couldn't verify this GSTIN automatically.",
    reason: lookup.errorReason ?? null,
  });
}
