import { NextRequest, NextResponse } from "next/server";
import { resyncFailedOrders } from "@/lib/resync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily backstop for orders that never reached Salesforce.
 *
 * Vercel's Hobby plan allows only one cron run per day, so this is the safety
 * net rather than the main mechanism — the orders route also sweeps after
 * every successful order, which is what actually keeps the lag small.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  // Vercel Cron sends the secret as a Bearer token. Skip the check only when
  // no secret is configured at all (local development).
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await resyncFailedOrders(50);
  return NextResponse.json(result);
}
