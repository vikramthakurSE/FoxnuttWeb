/**
 * Delivery rules by PIN code — the website's mirror of Salesforce's
 * DeliveryRules class, used to show hints in the cart and checkout before
 * the order is sent. Salesforce re-applies the same rules when the order
 * is placed, so this is for display, not enforcement.
 *
 *   Local       — PIN code in a local district (Bangalore): any order size.
 *   Home State  — rest of Karnataka: each brand needs its minimum KG.
 *   Other State — same minimums plus ₹/KG delivery on the whole order, capped.
 *
 * The numbers come from Salesforce (Delivery Setting custom metadata) with
 * the catalog; DEFAULT_DELIVERY_RULES is only the fallback when it is down.
 */

export type DeliveryZone = "Local" | "Home State" | "Other State";

export interface DeliveryRules {
  /** Upper case India Post district names. */
  localDistricts: string[];
  /** Upper case India Post state name. */
  homeState: string;
  defaultMinKg: number;
  /** Lower-case brand name (first word of the product brand) → KG. */
  brandMinKg: Record<string, number>;
  chargePerKg: number;
  /** Null means no cap. */
  maxCharge: number | null;
}

export const DEFAULT_DELIVERY_RULES: DeliveryRules = {
  localDistricts: ["BENGALURU URBAN", "BENGALURU RURAL"],
  homeState: "KARNATAKA",
  defaultMinKg: 10,
  brandMinKg: { holiday: 8 },
  chargePerKg: 5,
  maxCharge: 90,
};

/** GST on products only, never on delivery. Matches Salesforce GST_RATE. */
export const GST_RATE = 0.05;

/** A PIN code resolved against India Post data. */
export interface PincodeLocation {
  pincode: string;
  /** Most common district first; a PIN code can straddle districts. */
  districts: string[];
  state: string;
}

export interface CartLine {
  brand: string;
  kg: number;
}

export interface Shortfall {
  brand: string;
  minKg: number;
  kg: number;
}

export interface DeliveryQuote {
  zone: DeliveryZone;
  totalKg: number;
  charge: number;
  shortfalls: Shortfall[];
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

export function zoneFor(rules: DeliveryRules, loc: PincodeLocation): DeliveryZone {
  const local = new Set(rules.localDistricts.map(norm));
  if (loc.districts.some((d) => local.has(norm(d)))) return "Local";
  return norm(loc.state) === norm(rules.homeState) ? "Home State" : "Other State";
}

/** "Holiday_250g" and "Holiday loose" both count as Holiday. */
export function brandFamily(brand: string): string {
  return brand.trim().split(/[ _]/)[0] ?? "";
}

export function quoteDelivery(
  rules: DeliveryRules,
  zone: DeliveryZone,
  lines: CartLine[]
): DeliveryQuote {
  const byFamily = new Map<string, { label: string; kg: number }>();
  let totalKg = 0;
  for (const l of lines) {
    const label = brandFamily(l.brand);
    const key = label.toLowerCase();
    const cur = byFamily.get(key);
    byFamily.set(key, { label: cur?.label ?? label, kg: (cur?.kg ?? 0) + l.kg });
    totalKg += l.kg;
  }

  const quote: DeliveryQuote = { zone, totalKg, charge: 0, shortfalls: [] };
  if (zone === "Local") return quote;

  for (const [key, { label, kg }] of byFamily) {
    const minKg = rules.brandMinKg[key] ?? rules.defaultMinKg;
    // Compare in grams so 0.1 KG packs cannot miss by a float rounding error.
    if (Math.round(kg * 1000) < Math.round(minKg * 1000)) {
      quote.shortfalls.push({ brand: label, minKg, kg });
    }
  }
  if (zone === "Other State") {
    let charge = totalKg * rules.chargePerKg;
    if (rules.maxCharge != null && charge > rules.maxCharge) charge = rules.maxCharge;
    quote.charge = Math.round(charge * 100) / 100;
  }
  return quote;
}

/** "BENGALURU URBAN" → "Bengaluru Urban". */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** Short place label for the header chip and checkout, e.g. "Mysuru, Karnataka". */
export function placeLabel(loc: PincodeLocation): string {
  return `${titleCase(loc.districts[0] ?? "")}, ${titleCase(loc.state)}`;
}

/** One line on what this PIN code means for the order. */
export function zoneSummary(rules: DeliveryRules, zone: DeliveryZone): string {
  const holiday = rules.brandMinKg.holiday;
  const mins =
    holiday != null && holiday !== rules.defaultMinKg
      ? `min ${holiday} kg of Holiday and ${rules.defaultMinKg} kg of each other brand`
      : `min ${rules.defaultMinKg} kg of each brand`;
  if (zone === "Local") return "Delivery in Bangalore, any order size";
  if (zone === "Home State") return `Delivery outside Bangalore: ${mins}`;
  const cap = rules.maxCharge != null ? ` (max ₹${rules.maxCharge})` : "";
  return `Delivery to other states: ${mins}, plus ₹${rules.chargePerKg}/kg delivery${cap}`;
}

/** First 6-digit Indian PIN code in a free-text address, if any. */
export function pincodeInAddress(address: string): string | null {
  const all = address.match(/(?<!\d)[1-9]\d{2}\s?\d{3}(?!\d)/g);
  return all ? all[all.length - 1].replace(/\s/g, "") : null;
}

export function isPincode(s: string): boolean {
  return /^[1-9]\d{5}$/.test(s);
}

export interface PricedLine extends CartLine {
  /** Price before GST. */
  amount: number;
}

export interface OrderTotals {
  subtotal: number;
  gst: number;
  /** Null until a PIN code is known. */
  quote: DeliveryQuote | null;
  total: number;
}

/** What the buyer pays: products, 5% GST on products, delivery charge. */
export function orderTotals(
  lines: PricedLine[],
  rules: DeliveryRules,
  zone: DeliveryZone | null
): OrderTotals {
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const quote = zone ? quoteDelivery(rules, zone, lines) : null;
  return { subtotal, gst, quote, total: subtotal + gst + (quote?.charge ?? 0) };
}

export function formatKgShort(kg: number): string {
  return `${Math.round(kg * 100) / 100} kg`;
}
