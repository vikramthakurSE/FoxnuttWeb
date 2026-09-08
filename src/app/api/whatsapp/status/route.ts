import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Polled by the browser while the customer is in WhatsApp. Once the webhook
 * has marked the row verified, this issues the session cookie — exactly
 * once, then the row is consumed so the same token can't mint another.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }
    if (!hasDb()) {
      return NextResponse.json({ error: "Not configured." }, { status: 503 });
    }

    const db = sql();
    const rows = await db<
      {
        verified: boolean;
        consumed: boolean;
        phone: string | null;
        wa_name: string | null;
        expired: boolean;
      }[]
    >`
      SELECT verified, consumed, phone, wa_name, (expires_at <= now()) AS expired
        FROM wa_verifications WHERE token = ${token} LIMIT 1
    `;
    if (!rows.length) {
      return NextResponse.json({ status: "unknown" }, { status: 404 });
    }
    const row = rows[0];

    if (row.consumed) return NextResponse.json({ status: "consumed" });
    if (!row.verified) {
      return NextResponse.json({
        status: row.expired ? "expired" : "pending",
      });
    }
    if (!row.phone) return NextResponse.json({ status: "pending" });

    // Claim it atomically so a duplicate poll can't issue a second session.
    const claimed = await db`
      UPDATE wa_verifications SET consumed = true
       WHERE token = ${token} AND consumed = false
      RETURNING token
    `;
    if (!claimed.length) return NextResponse.json({ status: "consumed" });

    const customers = await db<
      {
        name: string | null;
        business_name: string | null;
        address: string | null;
        gstin: string | null;
      }[]
    >`
      SELECT name, business_name, address, gstin FROM customers
       WHERE phone = ${row.phone} LIMIT 1
    `;
    const customer = customers[0] ?? null;

    await createSession({
      phone: row.phone,
      name: customer?.name ?? row.wa_name ?? undefined,
    });

    return NextResponse.json({
      status: "verified",
      phone: row.phone,
      // Fall back to the WhatsApp profile name so first-time buyers get
      // their name pre-filled at checkout.
      customer:
        customer ??
        (row.wa_name
          ? { name: row.wa_name, business_name: null, address: null, gstin: null }
          : null),
    });
  } catch (e) {
    console.error("whatsapp/status failed:", e);
    return NextResponse.json({ error: "Status check failed." }, { status: 500 });
  }
}
