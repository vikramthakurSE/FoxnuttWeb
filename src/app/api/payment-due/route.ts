import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { fetchPaymentDue, sfConfigured, type SfPaymentDue } from "@/lib/salesforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTHING_DUE: SfPaymentDue = { overdue: [], totalDue: 0, daysLimit: 45 };

/**
 * What the logged-in client must pay before they can order again.
 * Only accounts with a business code can have history, so a first-time
 * buyer (or no session) simply gets an empty list.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.code || !sfConfigured()) {
    return NextResponse.json(NOTHING_DUE);
  }
  try {
    return NextResponse.json(await fetchPaymentDue(session.code));
  } catch (e) {
    // The order POST enforces the rule regardless, so failing open here
    // only costs the customer an earlier heads-up, never lets an order slip.
    console.error("payment-due lookup failed:", e);
    return NextResponse.json(NOTHING_DUE);
  }
}
