import { fetchCatalog, sfConfigured, type SfProduct } from "./salesforce";
import { isDemo } from "./demo";

/**
 * Catalog with a short in-memory cache so browsing doesn't hammer
 * Salesforce, plus a static fallback (matching the seeded Web_Product__c
 * records) so the site still renders if Salesforce is unreachable or the
 * Connected App isn't configured yet. The fallback is browse-only —
 * checkout revalidates against live Salesforce data.
 */

const TTL_MS = 60 * 1000;

let cache: { products: SfProduct[]; at: number; live: boolean } | null = null;

export const FALLBACK_PRODUCTS: SfProduct[] = [
  {
    slug: "holiday-250g",
    name: "Holiday Makhana — 250g Pouch",
    brand: "Holiday_250g",
    packetType: "250g",
    grade: "5 & 5+ Suta · Handpicked",
    description:
      "Our flagship handpicked line — large-grade fox nuts, sun-dried and sorted for uniform size and colour.",
    packSizeGrams: 250,
    packLabel: "250g pouch",
    pricePerKg: 1200,
    pricePerPacket: 300,
    minOrderPackets: 1,
    badge: "Flagship",
    gstApplied: false,
    availableKg: 0,
    availablePackets: 0,
    inStock: false,
  },
  {
    slug: "laddu-gopal-100g",
    name: "Laddu Gopal Makhana — 100g Pouch",
    brand: "Laddu 100g",
    packetType: "100g",
    grade: "4 & 5 Suta · Mixed",
    description:
      "Traditional-grade plain line, popular for everyday consumption, prasad / religious offering use and repacking.",
    packSizeGrams: 100,
    packLabel: "100g pouch",
    pricePerKg: 1050,
    pricePerPacket: 105,
    minOrderPackets: 1,
    badge: null,
    gstApplied: false,
    availableKg: 0,
    availablePackets: 0,
    inStock: false,
  },
  {
    slug: "gopala-250g",
    name: "Gopala Makhana — 250g Pouch",
    brand: "Gopala 250g",
    packetType: "250g",
    grade: "3 & 4 Suta · Mixed",
    description:
      "Value-grade plain line — smaller, mixed-size fox nuts, handpicked and sun-dried for buyers roasting at scale.",
    packSizeGrams: 250,
    packLabel: "250g pouch",
    pricePerKg: 800,
    pricePerPacket: 200,
    minOrderPackets: 1,
    badge: "Best Value",
    gstApplied: false,
    availableKg: 0,
    availablePackets: 0,
    inStock: false,
  },
  {
    slug: "trust-250g",
    name: "Trust Makhana — 250g Pouch",
    brand: "Trust 250g",
    packetType: "250g",
    grade: "3 & 4 Suta · Mixed",
    description: "Everyday plain makhana at an accessible price point.",
    packSizeGrams: 250,
    packLabel: "250g pouch",
    pricePerKg: 750,
    pricePerPacket: 187.5,
    minOrderPackets: 1,
    badge: null,
    gstApplied: false,
    availableKg: 0,
    availablePackets: 0,
    inStock: false,
  },
  {
    slug: "holiday-loose-10kg",
    name: "Loose Makhana — 10 kg Bulk Bag",
    brand: "Holiday loose",
    packetType: "Loose",
    grade: "All grades · 3–6 Suta",
    description:
      "Ungraded bulk supply, sold raw for buyers to roast, season or private-label on their end. Plain bag, no branding.",
    packSizeGrams: 10000,
    packLabel: "10 kg bulk bag",
    pricePerKg: 900,
    pricePerPacket: 9000,
    minOrderPackets: 1,
    badge: "Bulk",
    gstApplied: false,
    availableKg: 0,
    availablePackets: 0,
    inStock: false,
  },
];

export async function getCatalog(): Promise<{
  products: SfProduct[];
  live: boolean;
}> {
  // Demo mode: pretend everything is in stock so the flow is walkable.
  // One product is left out of stock to show that state too.
  if (isDemo() && !sfConfigured()) {
    return {
      products: FALLBACK_PRODUCTS.map((p) => {
        const stocked = p.slug !== "trust-250g";
        const availableKg = stocked ? 60 : 0;
        return {
          ...p,
          availableKg,
          availablePackets: Math.floor(availableKg / (p.packSizeGrams / 1000)),
          inStock: stocked,
        };
      }),
      live: true,
    };
  }
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { products: cache.products, live: cache.live };
  }
  if (sfConfigured()) {
    try {
      const products = await fetchCatalog();
      cache = { products, at: Date.now(), live: true };
      return { products, live: true };
    } catch (e) {
      console.error("Catalog fetch from Salesforce failed:", e);
      if (cache) return { products: cache.products, live: cache.live };
    }
  }
  return { products: FALLBACK_PRODUCTS, live: false };
}

export async function getProduct(
  slug: string
): Promise<{ product: SfProduct | null; live: boolean }> {
  const { products, live } = await getCatalog();
  return { product: products.find((p) => p.slug === slug) ?? null, live };
}
