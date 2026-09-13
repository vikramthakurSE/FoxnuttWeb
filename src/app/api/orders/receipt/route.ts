import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxies the Salesforce PDF receipt for one web order. Public and
 * unauthenticated on purpose: the order reference is a random UUID that
 * doubles as the read token, same model as /api/orders/payment — and this
 * exact URL is also what Meta fetches to attach the receipt on WhatsApp,
 * which cannot carry Salesforce session auth.
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim();
  if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) {
    return NextResponse.json({ error: "Invalid reference." }, { status: 400 });
  }
  if (!process.env.SF_INSTANCE_URL || !process.env.SF_CLIENT_ID || !process.env.SF_CLIENT_SECRET) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  try {
    const { sfFetchRaw } = await import("@/lib/salesforce");
    const res = await sfFetchRaw(
      `/store/v1/receipt?ref=${encodeURIComponent(ref)}`
    );
    if (res.status === 404) {
      return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "Could not fetch receipt." }, { status: 502 });
    }
    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt-${ref.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    console.error("receipt proxy failed:", e);
    return NextResponse.json({ error: "Could not fetch receipt." }, { status: 502 });
  }
}
