import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { sql, hasDb } from "@/lib/db";
import { createSession, normalizePhone } from "@/lib/session";
import { isDemo, demoStore } from "@/lib/demo";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = (await req.json()) as {
      phone?: string;
      code?: string;
    };
    const digits = normalizePhone(phone);
    if (!digits || !code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter the 6-digit code sent to your WhatsApp." },
        { status: 400 }
      );
    }
    if (isDemo() && !hasDb()) {
      const store = demoStore();
      const entry = store.otps.get(digits);
      if (!entry || entry.expiresAt < Date.now()) {
        return NextResponse.json(
          { error: "Code expired. Please request a new one." },
          { status: 400 }
        );
      }
      if (entry.code !== code) {
        return NextResponse.json(
          { error: "That code is not correct. Please check and try again." },
          { status: 400 }
        );
      }
      store.otps.delete(digits);
      const saved = store.customers.get(digits) ?? null;
      await createSession({ phone: digits, name: saved?.name });
      return NextResponse.json({
        ok: true,
        phone: digits,
        customer: saved
          ? {
              name: saved.name,
              business_name: saved.businessName,
              address: saved.address,
              gstin: saved.gstin,
            }
          : null,
      });
    }

    if (!hasDb()) {
      return NextResponse.json(
        { error: "The store is not fully set up yet (database missing)." },
        { status: 503 }
      );
    }

    const db = sql();
    const rows = await db<
      { id: number; code_hash: string; attempts: number }[]
    >`
      SELECT id, code_hash, attempts FROM otp_codes
      WHERE phone = ${digits} AND used = false AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Code expired. Please request a new one." },
        { status: 400 }
      );
    }
    const row = rows[0];
    if (row.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many wrong attempts. Please request a new code." },
        { status: 429 }
      );
    }

    const hash = createHash("sha256").update(code).digest("hex");
    if (hash !== row.code_hash) {
      await db`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
      return NextResponse.json(
        { error: "That code is not correct. Please check and try again." },
        { status: 400 }
      );
    }

    await db`UPDATE otp_codes SET used = true WHERE id = ${row.id}`;

    // Load any saved details for pre-filling checkout
    const customers = await db<
      { name: string | null; business_name: string | null; address: string | null; gstin: string | null }[]
    >`
      SELECT name, business_name, address, gstin FROM customers
      WHERE phone = ${digits} LIMIT 1
    `;
    const customer = customers[0] ?? null;

    await createSession({ phone: digits, name: customer?.name ?? undefined });

    return NextResponse.json({ ok: true, phone: digits, customer });
  } catch (e) {
    console.error("otp/verify failed:", e);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
