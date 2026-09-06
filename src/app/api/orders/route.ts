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

interface CartItem {
  slug: string;
  packets: number;
}
interface OrderBody {
  items: CartItem[];
  name: string;
  businessName?: string;
  address: string;
  gstin?: string;
  note?: string;
}

// ── Place an order ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please verify your phone number first." },
      { status: 401 }
    );
  }
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
    const store = demoStore();
    const known =
      store.knownClients.has(session.phone) ||
      store.customers.has(session.phone);
    const status = known ? "Confirmed" : "Pending Approval";
    const saleName = nextSaleName();
    store.customers.set(session.phone, {
      name: payload.name,
      businessName: payload.businessName,
      address: payload.address,
      gstin: payload.gstin,
    });
    store.orders.unshift({
      id: orderId,
      phone: session.phone,
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
    console.log(`[DEMO] Order ${saleName} (${status}) for +91${session.phone}`);
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
    VALUES (${session.phone}, ${payload.name}, ${payload.businessName},
            ${payload.address}, ${payload.gstin}, now())
    ON CONFLICT (phone) DO UPDATE SET
      name = EXCLUDED.name,
      business_name = COALESCE(EXCLUDED.business_name, customers.business_name),
      address = EXCLUDED.address,
      gstin = COALESCE(EXCLUDED.gstin, customers.gstin),
      last_order_at = now()
    RETURNING id
  `;
  await db`
    INSERT INTO orders (id, customer_id, phone, payload, total)
    VALUES (${orderId}, ${customer.id}, ${session.phone},
            ${JSON.stringify(payload)}::jsonb, ${total.toFixed(2)})
  `;

  // Sync to Salesforce — the order row survives even if this fails
  try {
    const result = await placeOrder({
      phone: session.phone,
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
