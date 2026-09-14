"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export interface LoggedInAccount {
  accountName: string | null;
  code: string;
  address: string | null;
  gstin: string | null;
  gstinVerified: boolean;
  gstinLegalName: string | null;
  gstinTradeName: string | null;
  gstinStatus: string | null;
}

export type CodeStage = "idle" | "verifying" | "error" | "verified";

/** Every real code today is 8 characters; a collision suffix can add one. */
const MIN_BOXES = 8;
const MAX_LEN = 10;
/** Spinner stays at least this long so verifying never flickers past. */
const MIN_VERIFY_MS = 900;

/**
 * Business-code login, styled as a code-entry card:
 *
 *  - one box per character, the active box lifted with a blinking caret
 *  - Verify turns dark when the code is complete, spins while checking,
 *    and the boxes bob in a wave
 *  - on success the lock opens, the boxes flood green, tilt and fuse into
 *    one circle, a tick draws, a ring pulses, and a green Continue button
 *    takes over
 *  - a wrong code shakes the boxes red and shows the message
 *
 * A single real <input> sits over the boxes, so typing, paste, mobile
 * keyboards and screen readers all behave like a normal text field.
 */
export default function BusinessCodeLogin({
  onLoggedIn,
  title,
  subtitle,
  titleId,
  continueLabel = "Continue",
  onStageChange,
}: {
  onLoggedIn: (account: LoggedInAccount) => void;
  /** Heading above the boxes; switches to "Verified!" on success. */
  title?: string;
  subtitle?: string;
  titleId?: string;
  continueLabel?: string;
  onStageChange?: (stage: CodeStage) => void;
}) {
  const [code, setCode] = useState("");
  const [stage, setStageRaw] = useState<CodeStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [account, setAccount] = useState<LoggedInAccount | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const setStage = (s: CodeStage) => {
    setStageRaw(s);
    onStageChange?.(s);
  };

  const boxes = Math.min(MAX_LEN, Math.max(MIN_BOXES, code.length));
  const complete = code.length >= MIN_BOXES;
  const verified = stage === "verified";
  const verifying = stage === "verifying";

  useEffect(() => {
    if (!verified) return;
    const t = setTimeout(() => continueRef.current?.focus(), 700);
    return () => clearTimeout(t);
  }, [verified]);

  async function submit() {
    if (!complete || verifying || verified) return;
    setStage("verifying");
    setError(null);
    const started = Date.now();
    const hold = () =>
      new Promise((r) => setTimeout(r, Math.max(0, MIN_VERIFY_MS - (Date.now() - started))));
    try {
      const res = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      await hold();
      if (!res.ok) throw new Error(json.error ?? "Login failed.");
      setAccount({
        accountName: json.accountName ?? null,
        code: json.code,
        address: json.address ?? null,
        gstin: json.gstin ?? null,
        gstinVerified: Boolean(json.gstinVerified),
        gstinLegalName: json.gstinLegalName ?? null,
        gstinTradeName: json.gstinTradeName ?? null,
        gstinStatus: json.gstinStatus ?? null,
      });
      setStage("verified");
    } catch (e) {
      await hold();
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("error");
      inputRef.current?.focus();
    }
  }

  const activeIndex = focused && !verifying && !verified ? Math.min(code.length, boxes - 1) : -1;

  return (
    <AutoHeight>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="text-center"
      >
        {title !== undefined && (
          <div className="mb-5">
            <div className={`nnc-lock mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-mist-2 shadow-[inset_0_1px_0_#fff,0_6px_14px_-8px_rgba(27,42,33,.35)] ${verified ? "nnc-lock-open" : ""}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink">
                <rect x="5" y="11" width="14" height="10" rx="2.5" />
                <path className="nnc-shackle" d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <div className="relative mt-4">
              <div className={`nnc-swap ${verified ? "nnc-swap-out" : ""}`} aria-hidden={verified}>
                <h2 id={verified ? undefined : titleId} className="font-display text-2xl font-bold">{title}</h2>
                {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
              </div>
              {verified && (
                <div className="nnc-swap-in absolute inset-x-0 top-0">
                  <h2 id={titleId} className="font-display text-2xl font-bold">
                    Verified!
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    {account?.accountName
                      ? `Welcome back, ${account.accountName}.`
                      : "Your business code has been verified."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Boxes and the success circle share one fixed-height stage. */}
        <div className="relative mx-auto h-14" style={{ maxWidth: boxes * 46 }}>
          <div
            className={`nnc-boxes absolute inset-0 grid gap-1.5 ${stage === "error" ? "nnc-shake" : ""} ${verified ? "nnc-boxes-done" : ""}`}
            style={{ gridTemplateColumns: `repeat(${boxes}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {Array.from({ length: boxes }, (_, i) => {
              const ch = code[i] ?? "";
              const k = (boxes - 1) / 2 - i;
              const style = {
                "--k": k,
                "--tilt": `${i % 2 === 0 ? -9 : 9}deg`,
                "--i": i,
              } as CSSProperties;
              return (
                <div
                  key={i}
                  style={style}
                  className={`nnc-box ${ch ? "nnc-box-filled" : ""} ${i === activeIndex ? "nnc-box-active" : ""} ${verifying ? "nnc-box-bob" : ""} ${stage === "error" ? "nnc-box-error" : ""}`}
                >
                  <span className="nnc-char">{ch}</span>
                  {i === activeIndex && !ch && <span className="nnc-caret" />}
                </div>
              );
            })}
          </div>

          {verified && (
            <div className="nnc-orb absolute left-1/2 top-1/2">
              <span className="nnc-ring" />
              <span className="nnc-ring nnc-ring-2" />
              <span className="nnc-orb-core">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                  <path className="nnc-orb-tick" d="M6 12.5 10 16.5 18 8" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          )}

          {!verified && (
            <input
              ref={inputRef}
              id="nn-code"
              aria-label="Business code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={MAX_LEN}
              value={code}
              disabled={verifying}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, MAX_LEN));
                if (stage === "error") {
                  setStage("idle");
                  setError(null);
                }
              }}
              onSelect={(e) => {
                const el = e.currentTarget;
                const end = el.value.length;
                if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
              }}
              className="nnc-code-input absolute inset-0 h-full w-full cursor-text"
            />
          )}
        </div>

        <div className="relative mt-5 h-12">
          <button
            ref={continueRef}
            type={verified ? "button" : "submit"}
            disabled={!verified && (!complete || verifying)}
            onClick={verified ? () => account && onLoggedIn(account) : undefined}
            className={`nnc-verify absolute inset-0 w-full overflow-hidden rounded-2xl font-semibold text-mist ${complete || verifying ? "nnc-verify-ready" : ""} ${verified ? "nnc-verify-done" : ""}`}
          >
            <span className={`nnc-btn-label ${verifying || verified ? "nnc-btn-label-out" : ""}`}>Verify code</span>
            <span className={`nnc-btn-label ${verifying ? "" : "nnc-btn-label-out"}`} aria-hidden={!verifying}>
              <span className="nnc-spin" aria-label="Verifying" />
            </span>
            <span className={`nnc-btn-label ${verified ? "nnc-btn-label-in" : "nnc-btn-label-out"}`} aria-hidden={!verified}>
              {continueLabel} <span aria-hidden="true">&nbsp;→</span>
            </span>
          </button>
        </div>

        {!subtitle && (
          <div className={`nnc-hint ${verified ? "nnc-hint-out" : ""}`}>
            <p className="pt-3 text-xs text-ink-soft">
              Your code is in the welcome message we sent you on WhatsApp.
            </p>
          </div>
        )}

        {error && stage === "error" && (
          <p role="alert" className="nnc-err mt-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <style>{`
          .nnc-code-input { opacity: 0; color: transparent; caret-color: transparent; background: transparent; border: 0; outline: none; font-size: 16px; }
          .nnc-lock { transition: transform .35s cubic-bezier(.34,1.56,.64,1); }
          .nnc-lock-open { transform: scale(1.08); }
          .nnc-shackle { transition: transform .4s cubic-bezier(.34,1.56,.64,1) .1s; transform-box: fill-box; transform-origin: 100% 100%; }
          .nnc-lock-open .nnc-shackle { transform: translate(-3px, -2px) rotate(-18deg); }

          .nnc-swap { transition: opacity .25s ease, transform .25s ease, filter .25s ease; }
          .nnc-swap-out { opacity: 0; transform: translateY(-6px); filter: blur(3px); }
          .nnc-swap-in { animation: nnc-swap-in .4s ease-out .12s both; }
          @keyframes nnc-swap-in { from { opacity: 0; transform: translateY(8px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }

          .nnc-box {
            position: relative; display: flex; align-items: center; justify-content: center;
            height: 52px; border-radius: 12px; background: #f8faf6;
            border: 1.5px solid #dde3d6; color: #1b2a21;
            font-size: 20px; font-weight: 700; font-family: var(--font-body);
            box-shadow: 0 1px 0 #fff inset, 0 4px 10px -8px rgba(27,42,33,.35);
            transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background-color .2s ease, color .2s ease;
          }
          .nnc-box-filled { background: #fff; border-color: #1b2a21; }
          .nnc-box-active { border-color: #1b2a21; border-width: 2.5px; transform: translateY(-2px); box-shadow: 0 0 0 4px rgba(27,42,33,.07), 0 10px 18px -10px rgba(27,42,33,.45); }
          .nnc-char { display: inline-block; animation: nnc-pop .18s ease-out; }
          .nnc-box:not(.nnc-box-filled) .nnc-char { animation: none; }
          @keyframes nnc-pop { from { transform: scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
          .nnc-caret { position: absolute; width: 2px; height: 22px; border-radius: 1px; background: #1b2a21; animation: nnc-blink 1s steps(1) infinite; }
          @keyframes nnc-blink { 50% { opacity: 0; } }

          .nnc-box-bob { animation: nnc-bob .9s ease-in-out infinite; animation-delay: calc(var(--i) * 70ms); }
          @keyframes nnc-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

          .nnc-shake { animation: nnc-shake .42s cubic-bezier(.36,.07,.19,.97); }
          @keyframes nnc-shake { 15%,85% { transform: translateX(-2px); } 30%,70% { transform: translateX(5px); } 45%,55% { transform: translateX(-7px); } }
          .nnc-box-error { border-color: #b42318; background: #fdf0ee; color: #912018; }

          /* Success: flood green, lose the characters, tilt, slide to the centre and fuse. */
          .nnc-boxes-done .nnc-box { animation: nnc-fuse .62s cubic-bezier(.55,0,.35,1) forwards; }
          .nnc-boxes-done .nnc-char, .nnc-boxes-done .nnc-caret { transition: opacity .15s ease; opacity: 0; }
          @keyframes nnc-fuse {
            0%   { background: #fff; border-color: #1b2a21; transform: none; border-radius: 12px; opacity: 1; }
            22%  { background: #6fd6a4; border-color: #3fbf85; transform: none; border-radius: 12px; }
            40%  { background: #2fb57a; border-color: #2fb57a; transform: rotate(var(--tilt)) scale(.94); border-radius: 12px; }
            78%  { background: #23a56d; border-color: #23a56d; transform: translateX(calc(var(--k) * (100% + 6px))) rotate(calc(var(--tilt) * -.5)) scale(.8); border-radius: 40%; opacity: 1; }
            100% { background: #1f9d66; border-color: #1f9d66; transform: translateX(calc(var(--k) * (100% + 6px))) scale(.55); border-radius: 50%; opacity: 0; }
          }

          .nnc-orb { width: 60px; height: 60px; margin: -30px 0 0 -30px; }
          .nnc-orb-core {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; border-radius: 9999px;
            background: radial-gradient(circle at 35% 30%, #34c48a, #17915c 70%);
            box-shadow: 0 10px 22px -8px rgba(23,145,92,.6), inset 0 1px 0 rgba(255,255,255,.35);
            transform: scale(0); animation: nnc-orb-in .5s cubic-bezier(.34,1.56,.64,1) .5s forwards;
          }
          @keyframes nnc-orb-in { from { transform: scale(.3); } to { transform: scale(1); } }
          .nnc-orb-tick { stroke-dasharray: 20; stroke-dashoffset: 20; animation: nnc-draw .38s ease-out .85s forwards; }
          @keyframes nnc-draw { to { stroke-dashoffset: 0; } }
          .nnc-ring { position: absolute; inset: -6px; border-radius: 9999px; border: 2px solid rgba(31,157,102,.45); opacity: 0; animation: nnc-ring 1.1s ease-out 1.05s forwards; }
          .nnc-ring-2 { animation-delay: 1.45s; }
          @keyframes nnc-ring { 0% { transform: scale(.85); opacity: .9; } 100% { transform: scale(1.55); opacity: 0; } }

          .nnc-verify { background: #b9b3ab; transition: background-color .45s ease, transform .15s ease, box-shadow .45s ease; }
          .nnc-verify-done, .nnc-verify-done:hover { background: #1f9d66 !important; box-shadow: 0 14px 26px -12px rgba(23,145,92,.75), inset 0 1px 0 rgba(255,255,255,.25); color: #fff; }
          .nnc-verify-done:hover { filter: brightness(1.05); }
          .nnc-verify:focus-visible { outline: none; box-shadow: 0 0 0 3px #ffffff, 0 0 0 5px rgba(27,42,33,.35); }
          .nnc-verify-done:focus-visible { box-shadow: 0 0 0 3px #ffffff, 0 0 0 5px rgba(31,157,102,.55), 0 14px 26px -12px rgba(23,145,92,.75); }
          .nnc-btn-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; transition: opacity .25s ease, transform .3s ease; }
          .nnc-btn-label-out { opacity: 0; transform: translateY(6px); pointer-events: none; }
          .nnc-btn-label-in { animation: nnc-continue-in .4s cubic-bezier(.34,1.3,.64,1) .35s both; }
          .nnc-verify-ready { background: #1c1e27; box-shadow: 0 10px 20px -12px rgba(28,30,39,.8); }
          .nnc-verify-ready:not(:disabled):hover { background: #2a2d39; }
          .nnc-verify:not(:disabled):active { transform: scale(.985); }
          .nnc-spin { display: block; width: 20px; height: 20px; border-radius: 9999px; border: 2.5px solid rgba(255,255,255,.3); border-top-color: #fff; animation: nnc-rot .7s linear infinite; }
          @keyframes nnc-rot { to { transform: rotate(360deg); } }

          @keyframes nnc-continue-in { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }

          .nnc-hint { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .35s ease, opacity .25s ease; }
          .nnc-hint > * { overflow: hidden; }
          .nnc-hint-out { grid-template-rows: 0fr; opacity: 0; }
          .nnc-err { animation: nnc-swap-in .3s ease-out both; }

          @media (prefers-reduced-motion: reduce) {
            .nnc-boxes-done .nnc-box { animation: none; opacity: 0; }
            .nnc-orb-core { animation: none; transform: none; }
            .nnc-orb-tick { animation: none; stroke-dashoffset: 0; }
            .nnc-ring, .nnc-box-bob, .nnc-shake, .nnc-caret, .nnc-btn-label-in, .nnc-swap-in { animation: none; }
          }
        `}</style>
      </form>
    </AutoHeight>
  );
}

/** Animates its own height as the content changes size, so the card shrinks smoothly. */
function AutoHeight({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{ height, transition: "height .45s cubic-bezier(.4,0,.2,1)" }} className="overflow-visible">
      <div ref={inner}>{children}</div>
    </div>
  );
}
