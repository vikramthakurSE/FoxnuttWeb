import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
