import { sql, hasDb } from "@/lib/db";
import { placeOrder, sfConfigured, SalesforceUserError } from "@/lib/salesforce";

export interface OrderPayload {
  items: { slug: string; packets: number }[];
  name: string;
  businessName: string | null;
  address: string;
  gstin: string | null;
  note: string | null;
  /** Present when an existing client ordered with their code. */
  businessCode?: string | null;
}

const MAX_ATTEMPTS = 10;

/**
 * Push orders that never reached Salesforce.
 *
 * Idempotent by orderRef, so a sale is never duplicated even if this races
 * with the cron or with itself. Returns counts rather than throwing: every
 * caller here is a background sweep whose failure must not surface to a
 * customer who has already ordered successfully.
 */
export async function resyncFailedOrders(
  limit = 10
): Promise<{ retried: number; synced: number }> {
  if (!hasDb() || !sfConfigured()) return { retried: 0, synced: 0 };

  const db = sql();
  const rows = await db<{ id: string; phone: string; payload: OrderPayload }[]>`
    SELECT id, phone, payload FROM orders
    WHERE status = 'sync_failed' AND sync_attempts < ${MAX_ATTEMPTS}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  let synced = 0;
  for (const row of rows) {
    try {
      const result = await placeOrder({
        businessCode: row.payload.businessCode ?? undefined,
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
      const message = String(e).slice(0, 500);
      if (e instanceof SalesforceUserError) {
        // A business rejection (deactivated product, stock gone) will never
        // succeed on a retry — park it at the cap so it stops being picked up.
        await db`
          UPDATE orders SET sync_attempts = ${MAX_ATTEMPTS},
            last_error = ${message}, updated_at = now()
          WHERE id = ${row.id}
        `;
      } else {
        await db`
          UPDATE orders SET sync_attempts = sync_attempts + 1,
            last_error = ${message}, updated_at = now()
          WHERE id = ${row.id}
        `;
      }
    }
  }
  return { retried: rows.length, synced };
}
