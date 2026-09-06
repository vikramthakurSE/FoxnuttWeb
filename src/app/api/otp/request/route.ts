import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { sql, hasDb } from "@/lib/db";
import { normalizePhone } from "@/lib/session";
import { sendOtp } from "@/lib/whatsapp";
import { isDemo, demoStore } from "@/lib/demo";

export const runtime = "nodejs";

const MAX_PER_WINDOW = 3; // codes per 10-minute window

export async function POST(req: NextRequest) {
  try {
    const { phone } = (await req.json()) as { phone?: string };
    const digits = normalizePhone(phone);
    if (!digits) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    }
    // Demo mode: hold the code in memory and hand it straight back so the
    // UI can display it — no WhatsApp template or database needed.
    if (isDemo() && !hasDb()) {
      const demoCode = String(randomInt(100000, 1000000));
      demoStore().otps.set(digits, {
        code: demoCode,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      console.log(`[DEMO] OTP for +91${digits}: ${demoCode}`);
      return NextResponse.json({ ok: true, devCode: demoCode });
    }

    if (!hasDb()) {
      return NextResponse.json(
        { error: "The store is not fully set up yet (database missing)." },
        { status: 503 }
      );
    }

    const db = sql();
    const [{ count }] = await db<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM otp_codes
      WHERE phone = ${digits}
      AND created_at > now() - interval '10 minutes'
    `;
    if (Number(count) >= MAX_PER_WINDOW) {
      return NextResponse.json(
        { error: "Too many codes requested. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const code = String(randomInt(100000, 1000000));
    const hash = createHash("sha256").update(code).digest("hex");
    await db`
      INSERT INTO otp_codes (phone, code_hash, expires_at)
      VALUES (${digits}, ${hash}, now() + interval '5 minutes')
    `;

    await sendOtp(digits, code);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("otp/request failed:", e);
    return NextResponse.json(
      { error: "Could not send the code. Please try again." },
      { status: 500 }
    );
  }
}
