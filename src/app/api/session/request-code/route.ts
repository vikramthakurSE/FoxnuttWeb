import { NextRequest, NextResponse } from "next/server";
import { requestCode } from "@/lib/salesforce";
import { normalizePhone } from "@/lib/session";
import { sfConfigured } from "@/lib/salesforce";

export const runtime = "nodejs";

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
    if (!sfConfigured()) {
      return NextResponse.json(
        { error: "This is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const sent = await requestCode(digits);
    // 200 with registered:false, not 404 — the UI needs to offer registration
    // rather than show a failure.
    return NextResponse.json({ ok: true, registered: sent });
  } catch (e) {
    console.error("session/request-code failed:", e);
    return NextResponse.json(
      { error: "Could not send your code. Please try again." },
      { status: 500 }
    );
  }
}
