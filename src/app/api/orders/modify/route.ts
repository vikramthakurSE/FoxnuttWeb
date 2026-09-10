import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { modifyOrder, sfConfigured, SalesforceUserError } from "@/lib/salesforce";

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
    const { saleId, lines } = (await req.json()) as {
      saleId?: string;
      lines?: Record<string, number>;
    };
    if (!saleId || !lines || Object.keys(lines).length === 0) {
      return NextResponse.json({ error: "No changes were supplied." }, { status: 400 });
    }
    const order = await modifyOrder(session.code, saleId, lines);
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    if (e instanceof SalesforceUserError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("orders/modify failed:", e);
    return NextResponse.json(
      { error: "Could not update that order. Please try again." },
      { status: 500 }
    );
  }
}
