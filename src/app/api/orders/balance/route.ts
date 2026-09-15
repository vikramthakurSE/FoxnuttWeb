import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { fetchOrderBalance, sfConfigured } from "@/lib/salesforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Balance of one of the logged-in client's own orders, by sale id. Used to
 * poll while a custom (often partial) payment against that specific order
 * is in flight from the orders page.
 *
 * The business code always comes from the signed session, never from the
 * request — a client could otherwise pass any code and probe another
 * client's order by guessing a sale id.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.code) {
    return NextResponse.json(
      { error: "Please log in with your business code first." },
      { status: 401 }
    );
  }
  const saleId = req.nextUrl.searchParams.get("saleId")?.trim();
  if (!saleId) {
    return NextResponse.json({ error: "Which order?" }, { status: 400 });
  }
  if (!sfConfigured()) return NextResponse.json({ found: false });
  try {
    return NextResponse.json(await fetchOrderBalance(session.code, saleId));
  } catch (e) {
    console.error("order-balance lookup failed:", e);
    return NextResponse.json({ found: false });
  }
}
