import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

const USPS = [
  {
    title: "Farm-direct sourcing",
    body: "Straight from Bihar's growing regions — home of India's premium lotus seed cultivation.",
  },
  {
    title: "Consistent suta grading",
    body: "Sorted 3–6 suta for uniform batches, hand-picked and sun-dried under controlled hygiene.",
  },
  {
    title: "Order on WhatsApp rails",
    body: "Confirmation, delivery and payment updates land on your WhatsApp automatically.",
  },
  {
    title: "Private label ready",
    body: "Custom branding, pack sizes and export documentation on request.",
  },
];

export default async function HomePage() {
  const { products } = await getCatalog();
  const featured = products.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pt-12 pb-10 sm:pt-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Katihar, Bihar · Est. quality since day one
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-6xl font-black leading-tight">
          <span className="text-terra">Nutty Nirvana</span>
          <br />
          Premium Makhana
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-soft">
          Hand-picked, sun-dried fox nuts — graded by size, packed with care,
          delivered with a WhatsApp message at every step.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/products"
            className="rounded-full bg-terra px-7 h-12 inline-flex items-center text-cream font-semibold hover:bg-terra-dark transition-colors"
          >
            Browse products
          </Link>
          <Link
            href="/orders"
            className="rounded-full border border-ink/20 px-7 h-12 inline-flex items-center font-semibold hover:bg-cream-2 transition-colors"
          >
            Track my orders
          </Link>
        </div>
        <p className="mt-5 text-xs text-ink-soft">
          100% natural · no additives · FSSAI registered
        </p>
        <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-gold/40 bg-gold/10 px-5 py-4 text-sm">
          <p className="font-semibold text-ink">
            Open for business-to-business ordering
          </p>
          <p className="mt-1 text-ink-soft">
            Our brands are available for B2B — every price shown here is a
            wholesale rate. New business accounts verify their GSTIN at
            checkout before their first order.
          </p>
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            Our lines
          </h2>
          <Link
            href="/products"
            className="text-sm font-semibold text-terra hover:text-terra-dark"
          >
            View all →
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-center">
          What sets us apart
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {USPS.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl bg-card border border-line shadow-card p-5"
            >
              <p className="font-display font-bold text-lg">{u.title}</p>
              <p className="mt-1.5 text-sm text-ink-soft">{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How ordering works */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl bg-ink text-cream p-6 sm:p-10">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-center">
            How ordering works
          </h2>
          <ol className="mt-6 grid gap-5 sm:grid-cols-3 text-sm">
            {[
              [
                "Pick your packs",
                "Choose from retail pouches or 10 kg bulk bags and add them to your cart.",
              ],
              [
                "Verify on WhatsApp",
                "Enter your mobile number and confirm the 6-digit code we send you.",
              ],
              [
                "We take it from there",
                "Regular customers are confirmed instantly; new customers get a quick check first. Every update arrives on WhatsApp.",
              ],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold font-bold text-ink">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold text-cream">{title}</span>
                  <span className="text-cream/70">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
