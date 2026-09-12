# Nutty Nirvana — Web Store

Mobile-first storefront for Nutty Nirvana Snacks. Customers browse the
makhana catalogue, verify their phone with a WhatsApp OTP, and place an
order — which lands in the FoxnuttApp Salesforce org as a real
`Sale__c` + `Sale_Line_Item__c`, wired into all the existing WhatsApp
automation.

```
Browser (Next.js pages)
   │
   ▼
Next.js API routes (Vercel)
   ├── Postgres (Supabase) ── customers, OTP codes, order log
   ├── WhatsApp Cloud API ─── OTP messages (same number as Salesforce)
   └── Salesforce REST ────── /services/apexrest/store/v1/*
                              (Connected App, client-credentials flow)
```

## How an order flows

1. Customer verifies their number via WhatsApp OTP → session cookie.
2. Order is saved to Postgres first (never lost), then synced to
   Salesforce with an idempotency key (`Web_Order_Ref__c`).
3. In Salesforce, `WebStoreService` matches the phone against
   `Account.Phone_Digits__c` (last 10 digits):
   - **Known client** → `Sale__c` created as **Confirmed** → existing
     trigger sends the WhatsApp order confirmation instantly.
   - **New customer** → Account created (Client record type, welcome
     WhatsApp fires) and the sale lands as **Pending Approval**. You
     review it in the app; flipping it to **Confirmed** sends the
     customer confirmation.
4. If the Salesforce call fails, the order stays `sync_failed` in
   Postgres and a Vercel cron (`/api/cron/sync-orders`, every 10 min)
   retries it — idempotently.

Pending Approval sales do **not** block inventory in your app, but the
website's availability math treats them as reserved so two web buyers
can't claim the same stock.

## Pay-first block for overdue payments

A client whose **delivered** order is still unpaid **45 days** after its
sale date cannot place a new order. Salesforce enforces it
(`WebStoreService.OVERDUE_DAYS`; the order POST answers 402) and the
website checks early via `/api/payment-due` as soon as a business code is
known, so the checkout form is replaced by a "please clear your pending
payment first" panel listing the orders, the total, and the PhonePe UPI
QR. The block lifts by itself once a `Client_Payment__c` is recorded in
Salesforce against that sale — the same record that already triggers the
payment-received WhatsApp.

Setup: put the QR image at `public/pay/phonepe-qr.png`; optionally set
`NEXT_PUBLIC_UPI_VPA` for a one-tap "Pay in UPI app" button on phones.

## Managing the catalogue

Products and prices live in Salesforce → App Launcher → **Web Products**.
Each record maps a website product to a `Brand__c` + `Packet_Type__c`
pair. `Price_Per_Kg__c` is the source of truth (the per-packet price is
a formula). Untick **Active** to hide a product. The website picks up
changes within ~1 minute. **The seeded prices are placeholders — review
them before going live.**

Product photos: drop a JPG at `public/products/<slug>.jpg`
(e.g. `public/products/holiday-250g.jpg`). Until then a branded colour
tile is shown.

## Local development

```bash
cp .env.example .env.local   # fill in the values below
npm install
npm run dev                  # http://localhost:3000
```

With no env vars set, the site still renders using a built-in catalogue
snapshot (browse-only, ordering disabled) — handy for styling work.

## One-time setup

### 1. Supabase (database)

1. Create a free project at supabase.com.
2. SQL Editor → paste and run `db/schema.sql`.
3. Project Settings → Database → copy the **URI** connection string
   (use the pooled/6543 one for Vercel) → `DATABASE_URL`.

### 2. Salesforce Connected App (client credentials)

In the Foxnutt org → Setup → App Manager → **New Connected App**:

1. Name: `Nutty Nirvana Web Store`; enable OAuth settings.
2. Callback URL: `https://login.salesforce.com/services/oauth2/callback`
   (unused by this flow, but required).
3. Scopes: **Manage user data via APIs (api)**.
4. Tick **Enable Client Credentials Flow** (untick PKCE requirement).
5. Save → Manage → Edit Policies → *Client Credentials Flow* → set
   **Run As** to your integration user (vikram@foxnutt.com works; that
   user must hold the `Web_Store_Admin` permission set — already
   assigned).
6. Manage Consumer Details → copy Consumer Key → `SF_CLIENT_ID`,
   Consumer Secret → `SF_CLIENT_SECRET`.
7. `SF_INSTANCE_URL` = `https://nirvanachores-dev-ed.develop.my.salesforce.com`.

### 3. WhatsApp OTP template

In Meta Business Manager → WhatsApp → Message Templates:

1. New template, category **Authentication**, name `nn_login_code`,
   language English (US).
2. Body: use Meta's standard authentication body (it auto-inserts the
   code parameter). Add the **Copy code** button.
3. Once approved, set `WA_OTP_TEMPLATE=nn_login_code` and
   `OTP_DEV_MODE=false`.

Until approval, keep `OTP_DEV_MODE=true` — the code is printed in the
server logs (Vercel → Functions → Logs) instead of being sent.

`WA_ACCESS_TOKEN` / `WA_PHONE_NUMBER_ID` are the same values you keep in
`WhatsApp_Config__mdt` in Salesforce.

### 4. Deploy to Vercel

```bash
npx vercel        # from this folder, then set env vars in the dashboard
```

Add every variable from `.env.example` in Vercel → Project → Settings →
Environment Variables. `vercel.json` already schedules the sync-retry
cron. Point your domain at the project and put the URL in your WhatsApp
profile / Instagram bio.

## What was added on the Salesforce side (FoxnuttApp repo)

| Piece | Purpose |
| --- | --- |
| `Web_Product__c` (+ tab, permission set) | Catalogue & pricing, managed in Salesforce |
| `Account.Phone_Digits__c` (+ trigger logic, backfilled) | Reliable phone → account matching |
| `Sale__c.Order_Source__c / Web_Order_Ref__c / Delivery_Address__c` | Web-order metadata + idempotency |
| `Order_Status__c` value **Pending Approval** | Holding state for first-time web customers |
| `WebStoreService` / `WebStoreAPI` (+ tests) | REST API: catalog, place order, order history |
| `SaleLineItemHelper` / `SaleTrigger` tweaks | No customer WhatsApp while pending; confirmation fires on approval |

## Day-to-day operations

- **New web order (new customer)** → you get the usual new-sale alert;
  open the sale, check it, set Order Status = **Confirmed** (or
  Cancelled). Confirmation WhatsApp goes out automatically.
- **New web order (known client)** → nothing to do; it behaves exactly
  like a sale you entered in Quick Sale.
- **Out of stock** → the site greys the product out automatically based
  on live inventory minus active orders.
