import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "nn_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  phone: string; // normalized 10 digits
  name?: string;
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not configured");
  return new TextEncoder().encode(s);
}

/** Strip to the last 10 digits — mirror of WebStoreService.normalizePhone. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^0-9]/g, "");
  if (d.length > 10) d = d.slice(-10);
  return d.length === 10 ? d : null;
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ phone: session.phone, name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_S,
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.phone !== "string") return null;
    return { phone: payload.phone, name: payload.name as string | undefined };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
