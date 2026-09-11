import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/session";
import { sql, hasDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ session: null });

  // Carry cached GSTIN verification along with the session so a returning
  // visitor (valid cookie, no fresh login) doesn't get re-gated at checkout.
  let gstinVerified = false;
  let gstinLegalName: string | null = null;
  let gstinTradeName: string | null = null;
  let gstinStatus: string | null = null;
  if (hasDb()) {
    try {
      const [row] = await sql()<
        {
          gstin_verified: boolean;
          gstin_legal_name: string | null;
          gstin_trade_name: string | null;
          gstin_status: string | null;
        }[]
      >`
        SELECT gstin_verified, gstin_legal_name, gstin_trade_name, gstin_status
        FROM customers WHERE phone = ${session.phone}
      `;
      if (row) {
        gstinVerified = row.gstin_verified;
        gstinLegalName = row.gstin_legal_name;
        gstinTradeName = row.gstin_trade_name;
        gstinStatus = row.gstin_status;
      }
    } catch (e) {
      console.error("session: gstin lookup failed:", e);
    }
  }

  return NextResponse.json({
    session: { ...session, gstinVerified, gstinLegalName, gstinTradeName, gstinStatus },
  });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
