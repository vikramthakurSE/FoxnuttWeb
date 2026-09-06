import type { Metadata } from "next";
import { getCatalog } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Products",
};

export default async function ProductsPage() {
  const { products, live } = await getCatalog();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Makhana (Foxnuts)</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Hand-picked · sun-dried · plain (unroasted) · 12-month shelf life
      </p>
      {!live && (
        <p className="mt-3 rounded-xl bg-gold/10 border border-gold/30 px-4 py-2.5 text-sm text-ink">
          Live stock is briefly unavailable — prices shown may be slightly out
          of date and ordering is paused. Please check back in a minute.
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}
