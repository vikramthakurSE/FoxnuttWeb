import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadCustomerProfile } from "@/lib/customerProfile";
import {
  fetchPaymentDue,
  fetchSavedAddresses,
  sfConfigured,
  type SfPaymentDue,
  type SfSavedAddress,
} from "@/lib/salesforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTHING_DUE: SfPaymentDue = { overdue: [], totalDue: 0, daysLimit: 45 };

/**
 * Everything checkout needs before it shows anything: who is signed in,
 * whether an old delivery is unpaid, and the client's saved addresses.
 * Checkout shows a loader until this answers, then goes straight to the
 * right screen instead of stepping through login → details → pay-first.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ session: null, due: NOTHING_DUE, addresses: [] });
  }

  const canAskSalesforce = Boolean(session.code) && sfConfigured();
  const [profile, dueResult, addressResult] = await Promise.allSettled([
    loadCustomerProfile(session.phone),
    canAskSalesforce ? fetchPaymentDue(session.code!) : Promise.resolve(NOTHING_DUE),
    canAskSalesforce ? fetchSavedAddresses(session.code!) : Promise.resolve([] as SfSavedAddress[]),
  ]);

  const p =
    profile.status === "fulfilled"
      ? profile.value
      : { gstinVerified: false, gstinLegalName: null, gstinTradeName: null, gstinStatus: null, address: null };

  // Failing open is safe: the order POST re-checks overdue payments itself.
  let due = NOTHING_DUE;
  if (dueResult.status === "fulfilled") due = dueResult.value;
  else console.error("bootstrap: payment-due failed:", dueResult.reason);

  let addresses: SfSavedAddress[] = [];
  if (addressResult.status === "fulfilled") addresses = addressResult.value;
  else console.error("bootstrap: saved addresses failed:", addressResult.reason);
  if (addresses.length === 0 && p.address?.trim()) {
    addresses = [{ address: p.address.trim(), source: "account", lastUsed: null }];
  }

  return NextResponse.json({
    session: {
      ...session,
      gstinVerified: p.gstinVerified,
      gstinLegalName: p.gstinLegalName,
      gstinTradeName: p.gstinTradeName,
      gstinStatus: p.gstinStatus,
    },
    due,
    addresses,
  });
}
