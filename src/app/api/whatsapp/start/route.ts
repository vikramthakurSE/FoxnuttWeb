import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
import { newCode, newToken, waDeepLink, CODE_TTL_MINUTES } from "@/lib/waverify";

export const runtime = "nodejs";

const MAX_PER_WINDOW = 8; // starts per IP per 10 minutes

export async function POST(req: NextRequest) {
  try {
    if (!hasDb()) {
      return NextResponse.json(
        { error: "The store is not fully set up yet." },
        { status: 503 }
      );
    }
    const link0 = waDeepLink("NN-TEST");
    if (!link0) {
      return NextResponse.json(
        { error: "WhatsApp verification is not configured yet." },
        { status: 503 }
      );
    }

    const db = sql();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

    const [{ count }] = await db<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM wa_verifications
      WHERE created_at > now() - interval '10 minutes'
        AND token LIKE ${ip + "|%"}
    `;
    if (Number(count) >= MAX_PER_WINDOW) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes." },
        { status: 429 }
      );
    }

    const code = newCode();
    // Prefix the IP so the rate-limit query above can count per client
    // without storing a separate column.
    const token = `${ip}|${newToken()}`;

    await db`
      INSERT INTO wa_verifications (token, code, expires_at)
      VALUES (${token}, ${code}, now() + (${CODE_TTL_MINUTES} || ' minutes')::interval)
    `;

    return NextResponse.json({
      ok: true,
      token,
      code,
      link: waDeepLink(code),
      expiresInSeconds: CODE_TTL_MINUTES * 60,
    });
  } catch (e) {
    console.error("whatsapp/start failed:", e);
    return NextResponse.json(
      { error: "Could not start verification. Please try again." },
      { status: 500 }
    );
  }
}
