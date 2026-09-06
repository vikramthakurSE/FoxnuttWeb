/**
 * Server-to-server Salesforce client.
 * Authenticates with the Connected App via OAuth 2.0 Client Credentials
 * and calls the WebStoreAPI Apex REST service (/services/apexrest/store/v1).
 */

export interface SfProduct {
  slug: string;
  name: string;
  brand: string;
  packetType: string;
  grade: string | null;
  description: string | null;
  packSizeGrams: number;
  packLabel: string | null;
  pricePerKg: number;
  pricePerPacket: number;
  minOrderPackets: number;
  badge: string | null;
  gstApplied: boolean;
  availableKg: number;
  availablePackets: number;
  inStock: boolean;
}

export interface SfOrderItem {
  slug: string;
  packets: number;
}

export interface SfOrderInput {
  phone: string;
  name: string;
  businessName?: string;
  address?: string;
  gstin?: string;
  note?: string;
  orderRef: string;
  items: SfOrderItem[];
}

export interface SfOrderResult {
  saleId: string;
  saleName: string;
  accountId: string;
  accountName: string;
  newCustomer: boolean;
  status: string;
  total: number;
  duplicate: boolean;
}

export interface SfPastOrder {
  saleId: string;
  saleName: string;
  orderRef: string | null;
  saleDate: string;
  status: string;
  paymentStatus: string | null;
  total: number | null;
  collected: number | null;
  balanceDue: number | null;
  expectedDelivery: string | null;
  items: {
    brand: string;
    packetType: string;
    quantityKg: number;
    ratePerKg: number;
    packets: number | null;
    lineAmount: number | null;
  }[];
}

/** Thrown for 4xx business errors from Apex (safe to show to the user). */
export class SalesforceUserError extends Error {}

export function sfConfigured(): boolean {
  return Boolean(
    process.env.SF_INSTANCE_URL &&
      process.env.SF_CLIENT_ID &&
      process.env.SF_CLIENT_SECRET
  );
}

// ── Token cache (per serverless instance) ────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const url = `${process.env.SF_INSTANCE_URL}/services/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.SF_CLIENT_ID!,
    client_secret: process.env.SF_CLIENT_SECRET!,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce auth failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { access_token: string };
  // Tokens live for the org's session timeout; refresh every 25 minutes.
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + 25 * 60 * 1000,
  };
  return json.access_token;
}

async function sfFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  const res = await fetch(
    `${process.env.SF_INSTANCE_URL}/services/apexrest${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    }
  );
  // Token expired between cache windows — retry once with a fresh token
  if (res.status === 401) {
    cachedToken = null;
    const fresh = await getToken();
    return fetch(`${process.env.SF_INSTANCE_URL}/services/apexrest${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${fresh}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  }
  return res;
}

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    return json.error ?? `Salesforce error ${res.status}`;
  } catch {
    return `Salesforce error ${res.status}`;
  }
}

// ── API surface ──────────────────────────────────────────────────────────

export async function fetchCatalog(): Promise<SfProduct[]> {
  const res = await sfFetch("/store/v1/catalog");
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { products: SfProduct[] };
  return json.products;
}

export async function placeOrder(input: SfOrderInput): Promise<SfOrderResult> {
  const res = await sfFetch("/store/v1/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (res.status === 400) throw new SalesforceUserError(await readError(res));
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { order: SfOrderResult };
  return json.order;
}

export async function fetchOrders(phone: string): Promise<SfPastOrder[]> {
  const res = await sfFetch(`/store/v1/orders?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { orders: SfPastOrder[] };
  return json.orders;
}
