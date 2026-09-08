"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface VerifiedCustomer {
  name: string | null;
  business_name: string | null;
  address: string | null;
  gstin: string | null;
}

type Phase = "idle" | "waiting" | "expired";

/**
 * WhatsApp reverse-verification.
 *
 * The customer sends us a pre-filled code from their own WhatsApp; Meta's
 * webhook tells us which number it came from. Nothing the browser reports
 * is trusted, so there is no number to type and nothing to spoof.
 */
export default function PhoneVerify({
  onVerified,
}: {
  onVerified: (phone: string, customer: VerifiedCustomer | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tokenRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  // Countdown
  useEffect(() => {
    if (phase !== "waiting" || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft]);

  useEffect(() => {
    if (phase === "waiting" && secondsLeft === 0) {
      stopPolling();
      setPhase("expired");
    }
  }, [phase, secondsLeft, stopPolling]);

  const poll = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      const res = await fetch(
        `/api/whatsapp/status?token=${encodeURIComponent(token)}`
      );
      const json = await res.json();
      if (json.status === "verified") {
        stopPolling();
        onVerified(json.phone as string, json.customer ?? null);
      } else if (json.status === "expired") {
        stopPolling();
        setPhase("expired");
      }
    } catch {
      /* transient — keep polling */
    }
  }, [onVerified, stopPolling]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/start", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start verification.");
      tokenRef.current = json.token;
      setCode(json.code);
      setLink(json.link);
      setSecondsLeft(json.expiresInSeconds ?? 600);
      setPhase("waiting");
      stopPolling();
      pollRef.current = setInterval(() => void poll(), 2500);
      // Open WhatsApp in a new tab; on mobile this hands off to the app.
      if (json.link) window.open(json.link, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div>
      {phase === "idle" && (
        <>
          <p className="text-sm text-ink-soft">
            Verify your number by sending us one WhatsApp message. We&apos;ll
            read your number from the message — nothing to type, no code to
            wait for.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
              <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37s-1.04 1.01-1.04 2.47 1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 01-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.38 9.38 0 01-1.44-5.01c0-5.18 4.22-9.4 9.42-9.4a9.36 9.36 0 016.65 2.76 9.32 9.32 0 012.75 6.65c0 5.18-4.22 9.4-9.41 9.4zm8-17.4A11.32 11.32 0 0012.04 1C5.8 1 .73 6.07.73 12.3c0 1.99.52 3.93 1.51 5.64L.64 24l6.2-1.62a11.3 11.3 0 005.2 1.31h.01c6.24 0 11.31-5.07 11.31-11.3 0-3.02-1.18-5.86-3.32-8z" />
            </svg>
            {busy ? "Opening WhatsApp…" : "Verify with WhatsApp"}
          </button>
        </>
      )}

      {phase === "waiting" && (
        <div>
          <p className="text-sm text-ink-soft">
            WhatsApp should have opened with a message already typed. Just tap{" "}
            <span className="font-semibold text-ink">send</span> — we&apos;ll
            verify you automatically.
          </p>
          <div className="mt-3 rounded-xl border border-line bg-cream-2 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Your code
            </p>
            <p className="mt-1 font-mono text-lg font-bold tracking-wider text-ink">
              {code}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#25D366]" />
            Waiting for your message… expires in {mmss}
          </div>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex h-12 w-full items-center justify-center rounded-full border border-line font-semibold text-ink hover:bg-cream-2"
            >
              Open WhatsApp again
            </a>
          )}
          <p className="mt-2 text-center text-xs text-ink-soft">
            WhatsApp didn&apos;t open? Send{" "}
            <span className="font-mono font-semibold">{code}</span> to our
            business number from any WhatsApp.
          </p>
        </div>
      )}

      {phase === "expired" && (
        <div>
          <p className="text-sm text-ink-soft">
            That code expired before we saw your message.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            className="mt-3 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-terra/30 bg-terra/10 px-4 py-2.5 text-sm text-terra-dark">
          {error}
        </p>
      )}
    </div>
  );
}
