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
    });
  } catch (e) {
    console.error("session/login failed:", e);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
