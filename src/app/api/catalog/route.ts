import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { products, live } = await getCatalog();
  return NextResponse.json({ products, live });
}
