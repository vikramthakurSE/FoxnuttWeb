/**
 * Server-to-server Salesforce client.
 * Authenticates with the Connected App via OAuth 2.0 Client Credentials
 * and calls the WebStoreAPI Apex REST service (/services/apexrest/store/v1).
 */

import type { DeliveryRules } from "./delivery";

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
  /** Existing client's login code. When set, Salesforce ignores the phone
   *  and takes the account from the code. */
  businessCode?: string;
  phone: string;
  name: string;
  businessName?: string;
  address?: string;
  /** Delivery PIN code with its India Post districts and state. */
  pincode: string;
  districts: string[];
  state: string;
  gstin?: string;
  note?: string;
  orderRef: string;
  /** 'online' (UPI before delivery) or 'cod' (default). */
  paymentMethod?: "online" | "cod";
  items: SfOrderItem[];
}

export interface SfOrderResult {
  saleId: string;
  saleName: string;
  accountId: string;
  accountName: string;
  newCustomer: boolean;
  status: string;
  /** Products with GST plus the delivery charge. */
  total: number;
  deliveryCharge?: number | null;
  duplicate: boolean;
}

export interface SfOrderEditResult {
  saleName: string;
  status: string;
  total: number;
  returnedForApproval: boolean;
}

/** Customer cancels their own order. Ownership is checked in Salesforce. */
export async function cancelOrder(
  businessCode: string,
  saleId: string
): Promise<SfOrderEditResult> {
  const res = await sfFetch("/store/v1/cancel-order", {
    method: "POST",
    body: JSON.stringify({ businessCode, saleId }),
  });
  if (res.status === 400) throw new SalesforceUserError(await readError(res));
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { order: SfOrderEditResult }).order;
}

/** Customer changes pack counts on their own order. 0 drops the line. */
export async function modifyOrder(
  businessCode: string,
  saleId: string,
  lines: Record<string, number>
): Promise<SfOrderEditResult> {
  const res = await sfFetch("/store/v1/modify-order", {
    method: "POST",
    body: JSON.stringify({ businessCode, saleId, lines }),
  });
  if (res.status === 400) throw new SalesforceUserError(await readError(res));
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { order: SfOrderEditResult }).order;
}

export interface SfPastOrder {
  saleId: string;
  saleName: string;
  editable?: boolean;
  orderRef: string | null;
  saleDate: string;
  status: string;
  paymentStatus: string | null;
  /** 'Online' | 'Cash on Delivery' (null for pre-feature orders). */
  paymentMethod?: string | null;
  /** Products with GST plus the delivery charge. */
  total: number | null;
  deliveryCharge?: number | null;
  deliveryPincode?: string | null;
  collected: number | null;
  balanceDue: number | null;
  /** Cancelled orders that held payments: "Pending" until sent back, then "Refunded". */
  refundStatus?: "Pending" | "Refunded" | null;
  refundAmount?: number | null;
  refundedOn?: string | null;
  expectedDelivery: string | null;
  items: {
    lineId?: string;
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

/** A delivered order still unpaid past the Salesforce OVERDUE_DAYS limit. */
export interface SfOverdueSale {
  saleId: string;
  saleName: string;
  saleDate: string;
  total: number | null;
  balanceDue: number;
  daysOld: number;
}

export interface SfPaymentDue {
  overdue: SfOverdueSale[];
  totalDue: number;
  daysLimit: number;
}

/**
 * Salesforce refused the order (HTTP 402) because the client owes on an
 * old delivery. Carries the orders so checkout can show what to pay.
 */
export class SalesforcePaymentDueError extends SalesforceUserError {
  constructor(message: string, public readonly due: SfPaymentDue) {
    super(message);
  }
}

async function readPaymentDue(res: Response): Promise<SalesforcePaymentDueError> {
  const json = (await res.json()) as Partial<SfPaymentDue> & { error?: string };
  return new SalesforcePaymentDueError(
    json.error ?? "Please clear your pending payment before ordering again.",
    {
      overdue: json.overdue ?? [],
      totalDue: Number(json.totalDue ?? 0),
      daysLimit: Number(json.daysLimit ?? 45),
    }
  );
}

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

/**
 * Like sfFetch, but exported for callers that need the raw Response (a
 * binary body, non-JSON content type) rather than a parsed result — the
 * PDF receipt proxy is the only current use.
 */
export async function sfFetchRaw(path: string, init?: RequestInit): Promise<Response> {
  return sfFetch(path, init);
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

export async function fetchCatalog(): Promise<{
  products: SfProduct[];
  /** Absent until Salesforce has the delivery rules deployed. */
  delivery: DeliveryRules | null;
}> {
  const res = await sfFetch("/store/v1/catalog");
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as {
    products: SfProduct[];
    delivery?: DeliveryRules;
  };
  return { products: json.products, delivery: json.delivery ?? null };
}

export async function placeOrder(input: SfOrderInput): Promise<SfOrderResult> {
  const res = await sfFetch("/store/v1/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (res.status === 402) throw await readPaymentDue(res);
  if (res.status === 400) throw new SalesforceUserError(await readError(res));
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { order: SfOrderResult };
  return json.order;
}

export interface SfOrderPayment {
  found: boolean;
  saleId?: string;
  saleName?: string;
  status?: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  total?: number | null;
  collected?: number | null;
  balanceDue?: number;
  paid?: boolean;
}

/** Payment state of one web order, by the website's order reference. */
export async function fetchOrderPayment(ref: string): Promise<SfOrderPayment> {
  const res = await sfFetch(
    `/store/v1/order-payment?ref=${encodeURIComponent(ref)}`
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as SfOrderPayment;
}

export interface SfOrderBalance {
  found: boolean;
  saleId?: string;
  saleName?: string;
  status?: string;
  total?: number | null;
  collected?: number | null;
  balanceDue?: number;
}

/**
 * Balance of one of a client's own orders, by sale id. Ownership is checked
 * server-side by the business code — this cannot be used to read anyone
 * else's order.
 */
export async function fetchOrderBalance(
  code: string,
  saleId: string
): Promise<SfOrderBalance> {
  const res = await sfFetch(
    `/store/v1/order-balance?code=${encodeURIComponent(code)}&saleId=${encodeURIComponent(saleId)}`
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as SfOrderBalance;
}

/** Old unpaid orders that stop this business code from ordering. */
export async function fetchPaymentDue(code: string): Promise<SfPaymentDue> {
  const res = await sfFetch(
    `/store/v1/payment-due?code=${encodeURIComponent(code)}`
  );
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as Partial<SfPaymentDue>;
  return {
    overdue: json.overdue ?? [],
    totalDue: Number(json.totalDue ?? 0),
    daysLimit: Number(json.daysLimit ?? 45),
  };
}

export interface SfSavedAddress {
  address: string;
  /** "order" = used on a past order; "account" = the account's own address. */
  source: "order" | "account";
  /** Date of the most recent order that used it, when known. */
  lastUsed: string | null;
}

/** A client's saved delivery addresses, most recent first. */
export async function fetchSavedAddresses(code: string): Promise<SfSavedAddress[]> {
  const res = await sfFetch(
    `/store/v1/addresses?code=${encodeURIComponent(code)}`
  );
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { addresses?: SfSavedAddress[] };
  return json.addresses ?? [];
}

export interface SfCodeLookup {
  found: boolean;
  accountId?: string;
  accountName?: string;
  phone?: string;
  code?: string;
  address?: string;
  gstin?: string;
}

export interface SfRegisterInput {
  name: string;
  phone: string;
  address?: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  gstin?: string;
}

export interface SfRegisterResult {
  accountId: string;
  accountName: string;
  businessCode: string;
  alreadyRegistered: boolean;
}

/**
 * Ask Salesforce to WhatsApp a client their login code.
 * Returns false when the number is on no account — the code itself never
 * comes back to the browser, so a stranger cannot read someone else's.
 */
export async function requestCode(phone: string): Promise<boolean> {
  const res = await sfFetch("/store/v1/request-code", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { sent: boolean };
  return json.sent;
}

/** Create a client account from the website registration form. */
export async function registerClient(
  input: SfRegisterInput
): Promise<SfRegisterResult> {
  const res = await sfFetch("/store/v1/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (res.status === 400) throw new SalesforceUserError(await readError(res));
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { account: SfRegisterResult };
  return json.account;
}

/** Resolve a client's business code to their Salesforce account. */
export async function verifyCode(code: string): Promise<SfCodeLookup> {
  const res = await sfFetch(
    `/store/v1/verify-code?code=${encodeURIComponent(code)}`
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as SfCodeLookup;
}

export async function fetchOrders(phone: string): Promise<SfPastOrder[]> {
  const res = await sfFetch(`/store/v1/orders?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { orders: SfPastOrder[] };
  return json.orders;
}
