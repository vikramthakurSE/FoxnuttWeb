# Go-Live Checklist

Work through these in order. Steps 1 and 2 are started first because they
involve waiting on other people (Meta review, price decisions).

Budget ~1 hour of actual work, plus however long Meta takes to approve the
template (usually minutes, occasionally a day).

---

## 1. Submit the WhatsApp OTP template — do this FIRST

It needs Meta's approval and everything else can happen while it's pending.

Meta Business Manager → WhatsApp Manager → **Message Templates** → Create:

| Field | Value |
| --- | --- |
| Name | `nn_login_code` |
| Category | **Authentication** (not Utility, not Marketing) |
| Language | English (US) |
| Body | Use Meta's standard authentication body — it inserts the code parameter itself |
| Button | Add the **Copy code** button |

> If you approve a template *without* a button, set `WA_OTP_BUTTON=false`
> in Vercel or sends fail with Meta error 132000.

### Confirm your access token is permanent

The website uses the same WhatsApp credentials as Salesforce. Check
Setup → Custom Metadata Types → **WhatsApp Config** → Manage Records, and
confirm the token there is a **System User token**, not a 24-hour test
token from the app dashboard.

If your Salesforce WhatsApp messages have been working for weeks without
you re-pasting a token, you already have a permanent one. If you *have*
been re-pasting it, fix that now — otherwise the website and your
existing Salesforce automation both break every day:

Meta Business Settings → Users → **System Users** → Add → assign the
WhatsApp app with `whatsapp_business_messaging` and
`whatsapp_business_management` → Generate token → expiry **Never**.

---

## 2. Review your prices — do this before anyone can order

App Launcher → **Web Products** → check every record's
**Price Per Kg**. The seeded values are placeholders I derived from your
recent sale rates:

| Product | Seeded price/kg | Shown to customer |
| --- | --- | --- |
| Holiday 250g | ₹1,200 | ₹300 / pouch |
| Laddu Gopal 100g | ₹1,050 | ₹105 / pouch |
| Gopala 250g | ₹800 | ₹200 / pouch |
| Trust 250g | ₹750 | ₹187.50 / pouch |
| Loose Makhana 10kg | ₹900 | ₹9,000 / bag |

These are the retail prices the public sees, so they should sit above
your usual wholesale rate. Untick **Active** on anything you don't want
to sell online (Trust and Loose bulk are worth a thought).

Set **Min Order Packets** if you don't want single-pouch orders — e.g. 4
on Holiday means a minimum of 1 kg.

---

## 3. Supabase (database)

1. supabase.com → New project (free tier). Save the DB password.
2. SQL Editor → paste all of `db/schema.sql` → Run.
3. Project Settings → Database → Connection string → **URI** tab.
   Use the **Transaction pooler** (port 6543) string for Vercel.
4. Replace `[YOUR-PASSWORD]` in it with your actual password.

That's your `DATABASE_URL`.

---

## 4. Salesforce Connected App

Setup → App Manager → **New Connected App** → *Create a Connected App*:

**Basic Information**
- Name: `Nutty Nirvana Web Store`
- Contact email: your email

**API (Enable OAuth Settings)** — tick *Enable OAuth Settings*
- Callback URL: `https://login.salesforce.com/services/oauth2/callback`
  (unused by this flow, but the form requires one)
- Selected scopes: **Manage user data via APIs (api)**
- Tick **Enable Client Credentials Flow**
- Untick *Require Proof Key for Code Exchange (PKCE)*
- Untick *Require Secret for Web Server Flow* is NOT needed — leave secrets required

Save. **Wait ~10 minutes** for it to propagate before testing.

Then App Manager → find it → **Manage** → **Edit Policies**:
- Permitted Users: *Admin approved users are pre-authorized*
- IP Relaxation: **Relax IP restrictions** ← required, Vercel IPs change
- Client Credentials Flow → **Run As**: `vikram@foxnutt.com`

Save. Then **Manage Profiles/Permission Sets** → add the
**Web Store Admin** permission set (already assigned to your user).

Finally: App Manager → **View** → *Manage Consumer Details* (it emails
you a verification code) → copy:
- Consumer Key → `SF_CLIENT_ID`
- Consumer Secret → `SF_CLIENT_SECRET`

---

## 5. Deploy to Vercel

```bash
cd ~/Desktop/nutty-nirvana-web
npx vercel          # first run links the project
npx vercel --prod
```

Then Vercel → Project → Settings → **Environment Variables**, add all of
these for Production:

```
DATABASE_URL        (from step 3)
SF_INSTANCE_URL     https://nirvanachores-dev-ed.develop.my.salesforce.com
SF_CLIENT_ID        (from step 4)
SF_CLIENT_SECRET    (from step 4)
WA_ACCESS_TOKEN     (from WhatsApp Config in Salesforce)
WA_PHONE_NUMBER_ID  (from WhatsApp Config in Salesforce)
WA_OTP_TEMPLATE     nn_login_code
WA_OTP_BUTTON       true
OTP_DEV_MODE        false
DEMO_MODE           false
SESSION_SECRET      (generate a long random string)
CRON_SECRET         (generate another one)
```

Redeploy after adding them (Vercel → Deployments → ⋯ → Redeploy).

`vercel.json` already schedules the order-retry cron every 10 minutes.

---

## 6. Smoke test on the live site

1. Open the Vercel URL on your phone.
2. Order one cheap item using **your own number** (`7277474053`) —
   you're an existing client, so it should confirm instantly and you
   should get the real WhatsApp order confirmation.
3. Check Salesforce: the Sale exists, Order Source = **Website**,
   status **Confirmed**, correct line items and rate.
4. Order again from a number that is *not* in your accounts — it should
   land as **Pending Approval** with no customer WhatsApp. Approve it in
   Salesforce and confirm the WhatsApp then fires.
5. Delete both test sales (deleting a non-Delivered sale doesn't touch
   inventory).

---

## 7. Domain and launch

- Vercel → Settings → Domains → add your domain, or just use the
  `*.vercel.app` URL.
- Put the link in your WhatsApp Business profile, Instagram bio
  (`@nutty_nirvana_snacks`), and the catalogue PDF.

---

## Day-to-day once live

- **Known client orders** → nothing to do, behaves like a Quick Sale entry.
- **New customer orders** → sale sits at **Pending Approval**. Review it,
  set **Confirmed** (fires the customer's WhatsApp confirmation) or
  **Cancelled**. Consider a list view filtered to
  `Order Status = Pending Approval` pinned in the app.
- **Price change** → edit the Web Product record; live within a minute.
- **Out of stock** → handled automatically from live inventory minus
  active orders. No action needed.

## Things to keep an eye on

- Your org is a **Developer Edition** (15,000 API calls/day). The catalog
  is cached for 60s, so normal browsing is cheap, but this is a real
  ceiling if the site ever gets busy.
- Orders that fail to reach Salesforce sit in the `orders` table with
  `status = 'sync_failed'` and retry automatically. To check:
  `select * from orders where status = 'sync_failed';` in Supabase.
