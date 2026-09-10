import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
import { createSession, normalizePhone } from "@/lib/session";
import {
  registerClient,
  sfConfigured,
  SalesforceUserError,
} from "@/lib/salesforce";
import { INDIAN_STATES, citiesFor } from "@/lib/india";

export const runtime = "nodejs";

interface Body {
  name?: string;
  phone?: string;
  address?: string;
  locality?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
}

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as Body;

    const name = b.name?.trim() ?? "";
    const locality = b.locality?.trim() ?? "";
    const city = b.city?.trim() ?? "";
    const state = b.state?.trim() ?? "";
    const pincode = b.pincode?.trim() ?? "";
    const digits = normalizePhone(b.phone);

    if (!name) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    if (!digits) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit WhatsApp number." },
        { status: 400 }
      );
    }
    if (!locality) {
      return NextResponse.json({ error: "Please enter your locality." }, { status: 400 });
    }
    // Validate the state and city against our own list rather than trusting
    // the browser — the selects are only a convenience, not a control.
    if (!INDIAN_STATES.includes(state)) {
      return NextResponse.json({ error: "Please choose your state." }, { status: 400 });
    }
    if (!citiesFor(state).includes(city)) {
      return NextResponse.json(
        { error: "Please choose a city in the selected state." },
        { status: 400 }
      );
    }
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      return NextResponse.json(
        { error: "Enter a valid 6-digit PIN code." },
        { status: 400 }
      );
    }
    if (!sfConfigured()) {
      return NextResponse.json(
        { error: "Registration is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const account = await registerClient({
      name,
      phone: digits,
      address: b.address?.trim() || undefined,
      locality,
      city,
      state,
      pincode,
      gstin: b.gstin?.trim() || undefined,
    });

    // Log them straight in — they just proved the number by typing it, and
    // the code is on its way to that WhatsApp regardless.
    await createSession({
      phone: digits,
      code: account.businessCode,
      accountName: account.accountName,
      name: account.accountName,
    });

    if (hasDb()) {
      try {
        await sql()`
          INSERT INTO customers (phone, name, business_name, address, gstin)
          VALUES (${digits}, ${name}, ${account.accountName},
                  ${[b.address?.trim(), locality, city, state, pincode]
                    .filter(Boolean)
                    .join(", ")},
                  ${b.gstin?.trim() || null})
          ON CONFLICT (phone) DO UPDATE SET
            name = EXCLUDED.name,
            business_name = COALESCE(EXCLUDED.business_name, customers.business_name),
            address = COALESCE(EXCLUDED.address, customers.address)
        `;
      } catch (e) {
        console.error("register: customer mirror failed:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      accountName: account.accountName,
      code: account.businessCode,
      alreadyRegistered: account.alreadyRegistered,
    });
  } catch (e) {
    if (e instanceof SalesforceUserError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("session/register failed:", e);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
