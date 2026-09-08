"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BusinessCodeLogin, { type LoggedInAccount } from "./BusinessCodeLogin";

/**
 * Login dialog.
 *
 * Rendered through a portal on purpose: the header sets backdrop-blur, and a
 * backdrop-filter establishes a containing block for fixed-position
 * descendants. Left inside the header, `fixed inset-0` would size itself to
 * the 64px bar and the dialog would cling to the top of the page.
 */
export default function LoginModal({
  open,
  onClose,
  onLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  onLoggedIn: (account: LoggedInAccount) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape to dismiss, and hold the page still behind the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nn-login-title"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 backdrop-blur-md p-4 animate-[fadeIn_120ms_ease-out]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-2 hover:text-ink"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <h2 id="nn-login-title" className="font-display text-xl font-bold">
          Login
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Use the business code we sent you on WhatsApp.
        </p>

        <div className="mt-4">
          <BusinessCodeLogin onLoggedIn={onLoggedIn} />
        </div>
      </div>
    </div>,
    document.body
  );
}
