import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, hasDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getCatalog } from "@/lib/catalog";
import {
  placeOrder,
  fetchOrders,
  sfConfigured,
  SalesforceUserError,
} from "@/lib/salesforce";
import { isDemo, demoStore, nextSaleName } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItem = {
  slug: string;
  packets: number;
};
interface OrderBody {
  items: CartItem[];
  name: string;
  businessName?: string;
  address: string;
  gstin?: string;
  note?: string;
  /** Existing client, logged in with their code. */
  businessCode?: string;
  /** First-time buyer with no code — they typed their own number. */
  phone?: string;
}

/** Strip to the last 10 digits, mirroring lib/session normalizePhone. */
function tidyPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^0-9]/g, "");
  if (d.length > 10) d = d.slice(-10);
  return d.length === 10 ? d : null;
}

// ── Place an order ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Two ways to order: logged in with a business code, or as a first-time
  // buyer who supplies their own number. No login is required to place an
  // order, so an absent session is normal here, not an error.
  const session = await getSession();
  if (!hasDb() && !isDemo()) {
    return NextResponse.json(
      { error: "The store is not fully set up yet (database missing)." },
      { status: 503 }
    );
  }

  let body: OrderBody;
  try {
    body = (await req.json()) as OrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // The session's code beats anything the browser sends, so a stale or
  // forged businessCode in the body cannot redirect an order to another
  // account. Salesforce re-checks the code regardless.
  const businessCode = session?.code ?? body.businessCode?.trim() ?? null;
  const orderPhone = session?.phone ?? tidyPhone(body.phone);
  if (!businessCode && !orderPhone) {
    return NextResponse.json(
      { error: "Enter your business code, or a 10-digit number to order as a first-time customer." },
      { status: 400 }
    );
  }
  // A logged-in session always carries the account's phone. Reaching here
  // without one means a code was posted with no session behind it, and the
  // local customers row (phone NOT NULL) could not be written.
  if (!orderPhone) {
    return NextResponse.json(
      { error: "Your session expired. Please enter your business code again." },
      { status: 401 }
    );
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!body.address?.trim()) {
    return NextResponse.json(
      { error: "Please enter a delivery address." },
      { status: 400 }
    );
  }

  // Validate items against the live catalog and compute the total server-side
  const { products, live } = await getCatalog();
  if (!live) {
    return NextResponse.json(
      { error: "Ordering is temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
  let total = 0;
  for (const item of body.items) {
    const p = products.find((x) => x.slug === item.slug);
    if (!p || !Number.isInteger(item.packets) || item.packets <= 0) {
      return NextResponse.json(
        { error: "Your cart has an invalid item. Please refresh and retry." },
        { status: 400 }
      );
    }
    if (item.packets > p.availablePackets) {
      return NextResponse.json(
        {
          error: `${p.name}: only ${p.availablePackets} pack(s) in stock right now.`,
        },
        { status: 409 }
      );
    }
    total += (p.pricePerKg * p.packSizeGrams * item.packets) / 1000;
  }

  const orderId = randomUUID();
  const payload = {
    items: body.items,
    name: body.name.trim(),
    businessName: body.businessName?.trim() || null,
    address: body.address.trim(),
    gstin: body.gstin?.trim() || null,
    note: body.note?.trim() || null,
  };

  // Demo mode: simulate what Salesforce would do, including the
  // known-client (auto-confirm) vs new-customer (hold) branch.
  if (isDemo() && !hasDb()) {
    const demoPhone = orderPhone ?? "0000000000";
    const store = demoStore();
    // Mirrors the real rule: every website order waits for approval.
    const status = "Pending Approval";
    const known = Boolean(businessCode) || store.customers.has(demoPhone);
    const saleName = nextSaleName();
    store.customers.set(demoPhone, {
      name: payload.name,
      businessName: payload.businessName,
      address: payload.address,
      gstin: payload.gstin,
    });
    store.orders.unshift({
      id: orderId,
      phone: demoPhone,
      saleName,
      status,
      total,
      createdAt: new Date().toISOString(),
      items: body.items.map((item) => {
        const p = products.find((x) => x.slug === item.slug)!;
        const quantityKg = (p.packSizeGrams * item.packets) / 1000;
        return {
          brand: p.brand,
          packetType: p.packetType,
          quantityKg,
          ratePerKg: p.pricePerKg,
          packets: item.packets,
          lineAmount: quantityKg * p.pricePerKg,
        };
      }),
    });
    console.log(`[DEMO] Order ${saleName} (${status}) for +91${demoPhone}`);
    return NextResponse.json({
      ok: true,
      orderId,
      saleName,
      status,
      newCustomer: !known,
      total,
    });
  }

  const db = sql();

  // Upsert the customer profile, then record the order before syncing
  const [customer] = await db<{ id: string }[]>`
    INSERT INTO customers (phone, name, business_name, address, gstin, last_order_at)
    VALUES (${orderPhone}, ${payload.name}, ${payload.businessName},
            ${payload.address}, ${payload.gstin}, now())
    ON CONFLICT (phone) DO UPDATE SET
      name = EXCLUDED.name,
      business_name = COALESCE(EXCLUDED.business_name, customers.business_name),
      address = EXCLUDED.address,
      gstin = COALESCE(EXCLUDED.gstin, customers.gstin),
      last_order_at = now()
    RETURNING id
  `;
  // Hand the object to db.json, not JSON.stringify: pre-stringifying stores
  // a jsonb *string* rather than an object, after which payload->>'items'
  // reads back null and the retry cron silently resyncs nothing.
  // The cast is only to satisfy postgres.js's JSONValue type, which does not
  // admit arrays of named types even though it serializes them correctly.
  await db`
    INSERT INTO orders (id, customer_id, phone, payload, total)
    VALUES (${orderId}, ${customer.id}, ${orderPhone},
            ${db.json(payload as unknown as Parameters<typeof db.json>[0])},
            ${total.toFixed(2)})
  `;

  // Sync to Salesforce — the order row survives even if this fails
  try {
    const result = await placeOrder({
      businessCode: businessCode ?? undefined,
      phone: orderPhone ?? "",
      name: payload.name,
      businessName: payload.businessName ?? undefined,
      address: payload.address,
      gstin: payload.gstin ?? undefined,
      note: payload.note ?? undefined,
      orderRef: orderId,
      items: body.items,
    });
    await db`
      UPDATE orders SET
        status = 'synced', sf_sale_id = ${result.saleId},
        sf_sale_name = ${result.saleName}, sf_status = ${result.status},
        sync_attempts = 1, updated_at = now()
      WHERE id = ${orderId}
    `;
    await db`
      UPDATE customers SET sf_account_id = ${result.accountId}
      WHERE id = ${customer.id}
    `;
    return NextResponse.json({
      ok: true,
      orderId,
      saleName: result.saleName,
      status: result.status,
      newCustomer: result.newCustomer,
      total,
    });
  } catch (e) {
    if (e instanceof SalesforceUserError) {
      // Business rejection (e.g. out of stock) — drop the local row too
      await db`DELETE FROM orders WHERE id = ${orderId}`;
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("Order sync failed:", e);
    await db`
      UPDATE orders SET
        status = 'sync_failed', sync_attempts = 1,
        last_error = ${String(e).slice(0, 500)}, updated_at = now()
      WHERE id = ${orderId}
    `;
    // The retry cron will pick it up — tell the customer it's received
    return NextResponse.json({
      ok: true,
      orderId,
      saleName: null,
      status: "Received",
      newCustomer: false,
      total,
    });
  }
}

// ── Order history ────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please verify your phone number first." },
      { status: 401 }
    );
  }

  if (isDemo() && !hasDb()) {
    const orders = demoStore()
      .orders.filter((o) => o.phone === session.phone)
      .map((o) => ({
        saleId: o.id,
        saleName: o.saleName,
        orderRef: o.id,
        saleDate: o.createdAt,
        status: o.status,
        paymentStatus: null,
        total: o.total,
        collected: null,
        balanceDue: o.status === "Delivered" ? 0 : o.total,
        expectedDelivery: null,
        items: o.items,
      }));
    return NextResponse.json({ orders, source: "demo" });
  }

  // Prefer live Salesforce history (authoritative statuses)
  if (sfConfigured()) {
    try {
      const orders = await fetchOrders(session.phone);
      return NextResponse.json({ orders, source: "salesforce" });
    } catch (e) {
      console.error("Salesforce order history failed:", e);
    }
  }

  // Fallback: local order log
  if (hasDb()) {
    const db = sql();
    const rows = await db<
      {
        id: string;
        payload: unknown;
        total: string;
        status: string;
        sf_sale_name: string | null;
        sf_status: string | null;
        created_at: string;
      }[]
    >`
      SELECT id, payload, total, status, sf_sale_name, sf_status, created_at
      FROM orders WHERE phone = ${session.phone}
      ORDER BY created_at DESC LIMIT 50
    `;
    return NextResponse.json({
      orders: rows.map((r) => ({
        saleId: r.id,
        saleName: r.sf_sale_name ?? "Processing",
        orderRef: r.id,
        saleDate: r.created_at,
        status: r.sf_status ?? "Received",
        paymentStatus: null,
        total: Number(r.total),
        collected: null,
        balanceDue: null,
        expectedDelivery: null,
        items: [],
      })),
      source: "local",
    });
  }
  return NextResponse.json({ orders: [], source: "none" });
}
