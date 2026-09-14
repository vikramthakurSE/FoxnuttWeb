"use client";

import { useState } from "react";
import BusinessCodeLogin, { type CodeStage, type LoggedInAccount } from "./BusinessCodeLogin";
import RequestCode from "./RequestCode";
import RegisterForm from "./RegisterForm";

type View = "login" | "request" | "notFound" | "register" | "registered";

/**
 * The full "how do I get in" flow — business-code login, request a
 * forgotten code, or register as a new business — factored out so both
 * the header's LoginModal and the checkout page's identify step offer the
 * exact same Request code / Register buttons with the same behaviour.
 */
export default function BusinessAccountAccess({
  onLoggedIn,
  loginTitle = "Login",
  loginSubtitle = "Use the business code we sent you on WhatsApp.",
  footer,
  titleId,
  continueLabel,
  onStageChange,
}: {
  onLoggedIn: (account: LoggedInAccount) => void;
  /** Heading shown above the code field, before any sub-view is entered. */
  loginTitle?: string;
  loginSubtitle?: string;
  /** Extra content under the button row, shown only in the "login" view. */
  footer?: React.ReactNode;
  /** Applied to every view's heading, so a wrapping dialog's aria-labelledby keeps working across views. */
  titleId?: string;
  /** Label of the green button shown after a code verifies. */
  continueLabel?: string;
  /** Lets the wrapping card react to the code login (e.g. wobble on success). */
  onStageChange?: (stage: CodeStage) => void;
}) {
  const [view, setView] = useState<View>("login");
  const [knownPhone, setKnownPhone] = useState("");
  const [registeredAccount, setRegisteredAccount] =
    useState<LoggedInAccount | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeStage, setCodeStage] = useState<CodeStage>("idle");

  const titles: Record<Exclude<View, "login">, string> = {
    request: "Request your code",
    notFound: "Not registered",
    register: "Register",
    registered: "You're all set!",
  };
  const subtitles: Record<Exclude<View, "login">, string> = {
    request: "We'll WhatsApp your code to the number we have on file.",
    notFound: "",
    register: "Takes a minute. We'll send your business code on WhatsApp.",
    registered: "",
  };

  if (view !== "login") {
    return (
      <div>
        <h2 id={titleId} className="font-display text-xl font-bold">{titles[view]}</h2>
        {subtitles[view] && (
          <p className="mt-1 text-sm text-ink-soft">{subtitles[view]}</p>
        )}
        <div className="mt-4">
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
                onRegistered={(a) => {
                  // The server already opened the session on this request —
                  // this screen's only job is to make sure the customer
                  // actually sees their ID before it scrolls away.
                  setRegisteredAccount({
                    accountName: a.accountName,
                    code: a.code,
                    address: null,
                    gstin: null,
                    gstinVerified: false,
                    gstinLegalName: null,
                    gstinTradeName: null,
                    gstinStatus: null,
                  });
                  setView("registered");
                }}
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

          {view === "registered" && registeredAccount && (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-leaf/15 text-2xl">
                ✓
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                Welcome{registeredAccount.accountName
                  ? `, ${registeredAccount.accountName}`
                  : ""}
                ! Here is your Business ID.
              </p>

              <div className="mt-4 rounded-xl border-2 border-dashed border-terra/40 bg-terra/5 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Your Business ID
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-ink">
                  {registeredAccount.code}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(registeredAccount.code)
                    .then(() => setCopied(true))
                    .catch(() => {});
                }}
                className="mt-3 h-11 w-full rounded-full border border-line text-sm font-semibold text-ink hover:bg-cream-2"
              >
                {copied ? "Copied ✓" : "Copy ID"}
              </button>

              <p className="mt-3 text-xs text-ink-soft">
                Save this somewhere safe — you&apos;ll use it to log in and
                track orders next time. You can also request it again anytime
                from the login screen.
              </p>

              <button
                type="button"
                onClick={() => onLoggedIn(registeredAccount)}
                className="mt-4 h-12 w-full rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark"
              >
                Start shopping
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const codeVerified = codeStage === "verified";

  return (
    <div>
      <BusinessCodeLogin
        title={loginTitle}
        subtitle={loginSubtitle}
        titleId={titleId}
        continueLabel={continueLabel}
        onLoggedIn={onLoggedIn}
        onStageChange={(s) => {
          setCodeStage(s);
          onStageChange?.(s);
        }}
      />
      <div className={`nn-access-extra ${codeVerified ? "nn-access-extra-out" : ""}`}>
        <div>
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
        {footer}
        </div>
      </div>
      <style>{`
        .nn-access-extra { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .4s cubic-bezier(.4,0,.2,1), opacity .25s ease; }
        .nn-access-extra > div { overflow: hidden; }
        .nn-access-extra-out { grid-template-rows: 0fr; opacity: 0; pointer-events: none; }
      `}</style>
    </div>
  );
}
