import { NextRequest, NextResponse } from "next/server";
import { fetchOrderPayment, sfConfigured } from "@/lib/salesforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Payment state of one web order, by the order reference the website
 * generated at checkout. The reference is a random UUID known only to the
 * ordering browser, so it doubles as the read token; no session is needed
 * (first-time buyers have none).
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim();
  if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) {
    return NextResponse.json({ error: "Invalid reference." }, { status: 400 });
  }
  if (!sfConfigured()) return NextResponse.json({ found: false });
  try {
    return NextResponse.json(await fetchOrderPayment(ref));
  } catch (e) {
    console.error("order-payment lookup failed:", e);
    return NextResponse.json({ found: false });
  }
}
