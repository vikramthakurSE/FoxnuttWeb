import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
import { placeOrder, sfConfigured, SalesforceUserError } from "@/lib/salesforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retries orders whose Salesforce sync failed (status = 'sync_failed').
 * Wire this to a Vercel Cron (vercel.json) every 10 minutes.
 * Idempotent: orderRef = order id, so Salesforce never duplicates a sale.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDb() || !sfConfigured()) {
    return NextResponse.json({ retried: 0, note: "not configured" });
  }

  const db = sql();
  const rows = await db<
    { id: string; phone: string; payload: OrderPayload }[]
  >`
    SELECT id, phone, payload FROM orders
    WHERE status = 'sync_failed' AND sync_attempts < 10
    ORDER BY created_at ASC
    LIMIT 10
  `;

  let synced = 0;
  for (const row of rows) {
    try {
      const result = await placeOrder({
        phone: row.phone,
        name: row.payload.name,
        businessName: row.payload.businessName ?? undefined,
        address: row.payload.address,
        gstin: row.payload.gstin ?? undefined,
        note: row.payload.note ?? undefined,
        orderRef: row.id,
        items: row.payload.items,
      });
      await db`
        UPDATE orders SET
          status = 'synced', sf_sale_id = ${result.saleId},
          sf_sale_name = ${result.saleName}, sf_status = ${result.status},
          sync_attempts = sync_attempts + 1, updated_at = now()
        WHERE id = ${row.id}
      `;
      synced++;
    } catch (e) {
      // A business rejection (e.g. product deactivated) will never succeed —
      // park it at the attempt cap so it stops retrying.
      if (e instanceof SalesforceUserError) {
        await db`
          UPDATE orders SET sync_attempts = 10,
            last_error = ${String(e).slice(0, 500)}, updated_at = now()
          WHERE id = ${row.id}
        `;
      } else {
        await db`
          UPDATE orders SET sync_attempts = sync_attempts + 1,
            last_error = ${String(e).slice(0, 500)}, updated_at = now()
          WHERE id = ${row.id}
        `;
      }
    }
  }
  return NextResponse.json({ retried: rows.length, synced });
}

interface OrderPayload {
  items: { slug: string; packets: number }[];
  name: string;
  businessName: string | null;
  address: string;
  gstin: string | null;
  note: string | null;
}
