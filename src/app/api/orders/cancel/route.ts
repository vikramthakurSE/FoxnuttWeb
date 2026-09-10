import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { cancelOrder, sfConfigured, SalesforceUserError } from "@/lib/salesforce";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  // The business code comes from the signed session, never the request body:
  // Salesforce uses it to decide whose order this is.
  if (!session?.code) {
    return NextResponse.json(
      { error: "Please log in with your business code first." },
      { status: 401 }
    );
  }
  if (!sfConfigured()) {
    return NextResponse.json(
      { error: "This is temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
  try {
    const { saleId } = (await req.json()) as { saleId?: string };
    if (!saleId) {
      return NextResponse.json({ error: "Which order?" }, { status: 400 });
    }
    const order = await cancelOrder(session.code, saleId);
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    if (e instanceof SalesforceUserError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("orders/cancel failed:", e);
    return NextResponse.json(
      { error: "Could not cancel that order. Please try again." },
      { status: 500 }
    );
  }
}
