"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BusinessCodeLogin, { type LoggedInAccount } from "./BusinessCodeLogin";
import RequestCode from "./RequestCode";
import RegisterForm from "./RegisterForm";

type View = "login" | "request" | "notFound" | "register";

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
  const [view, setView] = useState<View>("login");
  const [knownPhone, setKnownPhone] = useState("");
  useEffect(() => setMounted(true), []);

  // Always reopen on the login step, never mid-registration.
  useEffect(() => {
    if (open) {
      setView("login");
      setKnownPhone("");
    }
  }, [open]);

  const titles: Record<View, string> = {
    login: "Login",
    request: "Request your code",
    notFound: "Not registered",
    register: "Register",
  };
  const subtitles: Record<View, string> = {
    login: "Use the business code we sent you on WhatsApp.",
    request: "We'll WhatsApp your code to the number we have on file.",
    notFound: "",
    register: "Takes a minute. We'll send your business code on WhatsApp.",
  };

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
          {titles[view]}
        </h2>
        {subtitles[view] && (
          <p className="mt-1 text-sm text-ink-soft">{subtitles[view]}</p>
        )}

        <div className="mt-4">
          {view === "login" && (
            <>
              <BusinessCodeLogin onLoggedIn={onLoggedIn} />
              <div className="mt-5 grid gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setView("request")}
                  className="h-11 w-full rounded-full border border-line font-semibold text-ink hover:bg-cream-2"
                >
                  Request code
                </button>
                <button
                  type="button"
                  onClick={() => setView("register")}
                  className="h-11 w-full rounded-full border border-terra/40 font-semibold text-terra hover:bg-terra/5"
                >
                  New here? Register
                </button>
              </div>
            </>
          )}

          {view === "request" && (
            <RequestCode
              onBack={() => setView("login")}
              onNotRegistered={(phone) => {
                setKnownPhone(phone);
                setView("notFound");
              }}
            />
          )}

          {view === "notFound" && (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-terra/10 text-2xl">
                !
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                <span className="font-semibold text-ink">+91 {knownPhone}</span>{" "}
                is not registered with us yet.
              </p>
              <button
                type="button"
                onClick={() => setView("register")}
                className="mt-4 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark"
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => setView("request")}
                className="mt-2 w-full text-sm font-semibold text-ink-soft hover:text-ink"
              >
                Try another number
              </button>
            </div>
          )}

          {view === "register" && (
            <>
              <RegisterForm
                initialPhone={knownPhone}
                onRegistered={(a) =>
                  onLoggedIn({
                    accountName: a.accountName,
                    code: a.code,
                    address: null,
                    gstin: null,
                  })
                }
              />
              <button
                type="button"
                onClick={() => setView("login")}
                className="mt-2 w-full text-sm font-semibold text-ink-soft hover:text-ink"
              >
                I already have a code
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
