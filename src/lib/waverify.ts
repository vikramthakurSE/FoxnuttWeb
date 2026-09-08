import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * WhatsApp reverse-verification.
 *
 * Instead of us sending the customer a code (which needs a Meta-approved
 * authentication template and a verified business), the customer sends a
 * code to us. Their phone number arrives from Meta's webhook as the message
 * sender, so it cannot be spoofed by anything typed in the browser.
 */

/** Unambiguous alphabet — no O/0, I/1, so a customer can retype it if needed. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** ~40 bits of entropy. Long enough that guessing a live code is hopeless. */
export function newCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `NN-${out.slice(0, 4)}-${out.slice(4)}`;
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Strip to the last 10 digits, matching lib/session normalizePhone. */
export function phoneFromWaId(waId: string): string | null {
  const d = waId.replace(/[^0-9]/g, "");
  const last10 = d.length > 10 ? d.slice(-10) : d;
  return last10.length === 10 ? last10 : null;
}

/**
 * Verify Meta's X-Hub-Signature-256 over the raw body.
 *
 * This is the security boundary for the whole flow. Without it anyone who
 * finds the webhook URL could POST a forged "message" and mark any code
 * verified against any phone number they like. Never skip it in production.
 */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WA_APP_SECRET;
  if (!secret) return false;
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = header.slice("sha256=".length);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(got, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** Build the deep link that opens WhatsApp with the code pre-typed. */
export function waDeepLink(code: string): string | null {
  const num = process.env.WA_BUSINESS_NUMBER?.replace(/[^0-9]/g, "");
  if (!num) return null;
  const text = `${code}\n\nSending this verifies my number on the Nutty Nirvana store.`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export const CODE_TTL_MINUTES = 10;
