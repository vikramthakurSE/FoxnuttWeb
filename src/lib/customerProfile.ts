import { sql, hasDb } from "@/lib/db";

export interface CustomerProfile {
  gstinVerified: boolean;
  gstinLegalName: string | null;
  gstinTradeName: string | null;
  gstinStatus: string | null;
  /** Last address used on the website, a fallback when Salesforce has none. */
  address: string | null;
}

const EMPTY: CustomerProfile = {
  gstinVerified: false,
  gstinLegalName: null,
  gstinTradeName: null,
  gstinStatus: null,
  address: null,
};

/**
 * Cached GSTIN verification and last-used address for a phone, from the
 * local customers table. Never throws: a missing table or column (e.g. a
 * migration not yet applied) just means "nothing cached".
 */
export async function loadCustomerProfile(phone: string): Promise<CustomerProfile> {
  if (!hasDb()) return EMPTY;
  try {
    const [row] = await sql()<{
      gstin_verified: boolean;
      gstin_legal_name: string | null;
      gstin_trade_name: string | null;
      gstin_status: string | null;
      address: string | null;
    }[]>`
      SELECT gstin_verified, gstin_legal_name, gstin_trade_name, gstin_status, address
      FROM customers WHERE phone = ${phone}
    `;
    if (!row) return EMPTY;
    return {
      gstinVerified: row.gstin_verified,
      gstinLegalName: row.gstin_legal_name,
      gstinTradeName: row.gstin_trade_name,
      gstinStatus: row.gstin_status,
      address: row.address,
    };
  } catch (e) {
    console.error("customer profile lookup failed:", e);
    return EMPTY;
  }
}
