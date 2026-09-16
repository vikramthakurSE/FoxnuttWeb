import { NextRequest, NextResponse } from "next/server";
import { lookupPincode } from "@/lib/pincode";
import { getCatalog } from "@/lib/catalog";
import { zoneFor } from "@/lib/delivery";

export const runtime = "nodejs";

/**
 * Resolve a delivery PIN code for the header chip and checkout: its India
 * Post district and state, the delivery zone, and the rules that zone uses.
 */
export async function GET(req: NextRequest) {
  const pin = req.nextUrl.searchParams.get("pin") ?? "";
  const location = lookupPincode(pin);
  if (!location) {
    return NextResponse.json(
      { found: false, error: "We couldn't find this PIN code. Please check it." },
      { status: 404 }
    );
  }
  const { delivery } = await getCatalog();
  return NextResponse.json({
    found: true,
    location,
    zone: zoneFor(delivery, location),
    rules: delivery,
  });
}
