/**
 * DEMO MODE — local walkthrough without Supabase or Salesforce.
 *
 * Enabled only when DEMO_MODE=true. Everything lives in memory and is lost
 * when the server restarts. Never enable this in production: it accepts
 * orders that go nowhere.
 */

export function isDemo(): boolean {
  return process.env.DEMO_MODE === "true";
}

interface DemoOrder {
  id: string;
  phone: string;
  saleName: string;
  status: string;
  total: number;
  createdAt: string;
  items: {
    brand: string;
    packetType: string;
    quantityKg: number;
    ratePerKg: number;
    packets: number;
    lineAmount: number;
  }[];
}

interface DemoCustomer {
  name: string;
  businessName: string | null;
  address: string;
  gstin: string | null;
}

interface DemoStore {
  otps: Map<string, { code: string; expiresAt: number }>;
  customers: Map<string, DemoCustomer>;
  orders: DemoOrder[];
  seq: number;
  /** Phones seeded as "existing Salesforce clients" so the auto-confirm
   *  path is demonstrable on a fresh server. */
  knownClients: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __nnDemo: DemoStore | undefined;
}

export function demoStore(): DemoStore {
  if (!global.__nnDemo) {
    global.__nnDemo = {
      otps: new Map(),
      customers: new Map(),
      orders: [],
      seq: 1041,
      // Rohan's and Vikram's numbers behave like existing clients
      knownClients: new Set(["9008841421", "7277474053"]),
    };
  }
  return global.__nnDemo;
}

export function nextSaleName(): string {
  const store = demoStore();
  store.seq += 1;
  return `SAL-${String(store.seq).padStart(4, "0")}`;
}
