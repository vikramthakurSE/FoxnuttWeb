import { notFound } from "next/navigation";
import { getProduct } from "@/lib/catalog";
import ProductDetail from "./ProductDetail";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { product, live } = await getProduct(slug);
  if (!product) notFound();
  return <ProductDetail product={product} live={live} />;
}
