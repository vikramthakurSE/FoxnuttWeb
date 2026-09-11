import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyCode, sfConfigured } from "@/lib/salesforce";

export const runtime = "nodejs";

/** Codes look like ABC12345, plus an optional collision suffix. */
const CODE_RE = /^[A-Z]{3}[0-9]{5}[0-9]*$/;

export async function POST(req: NextRequest) {
  try {
    const { code } = (await req.json()) as { code?: string };
    const clean = (code ?? "").trim().toUpperCase().replace(/\s+/g, "");

    if (!CODE_RE.test(clean)) {
      return NextResponse.json(
        { error: "That doesn't look like a business code. Check your welcome message on WhatsApp." },
        { status: 400 }
      );
    }
    if (!sfConfigured()) {
      return NextResponse.json(
        { error: "Login is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const found = await verifyCode(clean);
    if (!found.found || !found.phone) {
      // Deliberately vague: confirming which codes exist would let someone
      // enumerate the client list.
      return NextResponse.json(
        { error: "We couldn't find that business code. Please check and try again." },
        { status: 404 }
      );
    }

    await createSession({
      phone: found.phone,
      code: found.code ?? clean,
      accountName: found.accountName,
      name: found.accountName,
    });

    // Mirror the account into the local table so checkout can prefill even
    // if Salesforce is briefly unreachable later.
    let gstinVerified = false;
    let gstinLegalName: string | null = null;
    let gstinTradeName: string | null = null;
    let gstinStatus: string | null = null;
    if (hasDb()) {
      try {
        await sql()`
          INSERT INTO customers (phone, name, business_name, address, gstin)
          VALUES (${found.phone}, ${found.accountName ?? null},
                  ${found.accountName ?? null}, ${found.address ?? null},
                  ${found.gstin ?? null})
          ON CONFLICT (phone) DO UPDATE SET
            business_name = COALESCE(EXCLUDED.business_name, customers.business_name),
            address       = COALESCE(customers.address, EXCLUDED.address),
            gstin         = COALESCE(customers.gstin, EXCLUDED.gstin)
        `;
        // Grandfathered or previously-verified accounts carry gstin_verified
        // = true — the checkout page uses this to decide whether to show
        // the GSTIN verification gate at all.
        const [row] = await sql()<
          {
            gstin_verified: boolean;
            gstin_legal_name: string | null;
            gstin_trade_name: string | null;
            gstin_status: string | null;
          }[]
        >`
          SELECT gstin_verified, gstin_legal_name, gstin_trade_name, gstin_status
          FROM customers WHERE phone = ${found.phone}
        `;
        if (row) {
          gstinVerified = row.gstin_verified;
          gstinLegalName = row.gstin_legal_name;
          gstinTradeName = row.gstin_trade_name;
          gstinStatus = row.gstin_status;
        }
      } catch (e) {
        console.error("session/login: customer mirror failed:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      accountName: found.accountName,
      code: found.code ?? clean,
      address: found.address ?? null,
      gstin: found.gstin ?? null,
      gstinVerified,
      gstinLegalName,
      gstinTradeName,
      gstinStatus,
    });
  } catch (e) {
    console.error("session/login failed:", e);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
