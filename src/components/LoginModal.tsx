"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BusinessAccountAccess from "./BusinessAccountAccess";
import type { LoggedInAccount } from "./BusinessCodeLogin";

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
  // Bumping this key remounts BusinessAccountAccess, resetting its internal
  // view back to "login" — simpler than lifting all of its state up here.
  const [resetKey, setResetKey] = useState(0);
  // Registration opens the session server-side already; this only tracks
  // whether dismissing the modal should still carry that account into the
  // header, since "Start shopping" is not the only way out of the dialog.
  const [justRegistered, setJustRegistered] =
    useState<LoggedInAccount | null>(null);
  const [codeVerified, setCodeVerified] = useState(false);

  function dismiss() {
    if (justRegistered) onLoggedIn(justRegistered);
    else onClose();
  }
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setResetKey((k) => k + 1);
      setJustRegistered(null);
      setCodeVerified(false);
    }
  }, [open]);

  // Escape to dismiss, and hold the page still behind the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // Re-subscribes whenever dismiss's behaviour actually changes, so Escape
    // pressed right after a successful registration still carries the new
    // session into the header instead of calling a stale onClose.
  }, [open, justRegistered, onLoggedIn, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nn-login-title"
      onClick={dismiss}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 backdrop-blur-md p-4 animate-[fadeIn_120ms_ease-out]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm rounded-3xl border border-line bg-card p-7 shadow-2xl animate-[nnDialogIn_.35s_cubic-bezier(.34,1.3,.64,1)] ${codeVerified ? "nn-card-wobble" : ""}`}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-mist-2 hover:text-ink"
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

        <BusinessAccountAccess
          key={resetKey}
          titleId="nn-login-title"
          continueLabel="Start shopping"
          onStageChange={(st) => setCodeVerified(st === "verified")}
          onLoggedIn={(a) => {
            setJustRegistered(a);
            onLoggedIn(a);
          }}
        />
      </div>
    </div>,
    document.body
  );
}
