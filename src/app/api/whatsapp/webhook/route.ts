import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
import { verifySignature, phoneFromWaId } from "@/lib/waverify";

export const runtime = "nodejs";

/**
 * Meta's one-time subscription handshake. Meta GETs this URL with a
 * challenge; echo it back verbatim when the verify token matches.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WA_WEBHOOK_VERIFY_TOKEN;
  if (
    p.get("hub.mode") === "subscribe" &&
    expected &&
    p.get("hub.verify_token") === expected
  ) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

interface WaMessage {
  from?: string;
  type?: string;
  text?: { body?: string };
}
interface WaContact {
  wa_id?: string;
  profile?: { name?: string };
}

/**
 * Inbound messages. A message whose text contains a live verification code
 * marks that code verified against the SENDER's number — which Meta gives
 * us, so the customer cannot claim a number they don't control.
 *
 * Always returns 200: Meta retries non-2xx aggressively, and a retry storm
 * over a message we simply don't care about is worse than silence.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.warn("whatsapp/webhook: bad or missing signature — ignored");
    return new NextResponse("ok", { status: 200 });
  }
  if (!hasDb()) return new NextResponse("ok", { status: 200 });

  try {
    const body = JSON.parse(raw);
    const db = sql();

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const contacts: WaContact[] = value.contacts ?? [];
        for (const msg of (value.messages ?? []) as WaMessage[]) {
          if (msg.type !== "text") continue;
          const text = msg.text?.body ?? "";
          const from = msg.from ? phoneFromWaId(msg.from) : null;
          if (!from) continue;

          // Codes look like NN-XXXX-XXXX. Pull every candidate out of the
          // message so extra words the customer typed don't break matching.
          const codes = text.toUpperCase().match(/NN-[A-Z0-9]{4}-[A-Z0-9]{4}/g);
          if (!codes?.length) continue;

          const waName =
            contacts.find((c) => phoneFromWaId(c.wa_id ?? "") === from)?.profile
              ?.name ?? null;

          for (const code of codes) {
            const updated = await db`
              UPDATE wa_verifications
                 SET verified = true, phone = ${from}, wa_name = ${waName}
               WHERE code = ${code}
                 AND verified = false
                 AND expires_at > now()
              RETURNING token
            `;
            if (updated.length) {
              console.log(`whatsapp/webhook: verified +91${from} via ${code}`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("whatsapp/webhook: processing failed:", e);
  }
  return new NextResponse("ok", { status: 200 });
}
