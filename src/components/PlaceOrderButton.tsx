"use client";

import { forwardRef, useImperativeHandle, useState } from "react";

type Phase = "idle" | "driving" | "success";

/**
 * The checkout submit button. A tap sends a little delivery truck driving
 * across the pill on a dashed road, then — once the order actually
 * succeeds — the road clears and "Order Placed" checks in. The drive
 * always plays for at least MIN_DRIVE_MS so a fast response doesn't look
 * like nothing happened; a failed order skips straight back to idle and
 * leaves the real error message (rendered by the caller) to explain why.
 */
export interface PlaceOrderButtonHandle {
  /** Lets the wrapping <form>'s Enter-to-submit trigger the same animation. */
  trigger: () => void;
}

const PlaceOrderButton = forwardRef<PlaceOrderButtonHandle, {
  idleLabel: string;
  disabled?: boolean;
  /** Does the real work; resolve true only once the order is placed. */
  onSubmit: () => Promise<boolean>;
  /** Called after the checkmark has been on screen a moment. */
  onSuccessShown: () => void;
}>(function PlaceOrderButton(
  { idleLabel, disabled, onSubmit, onSuccessShown },
  ref
) {
  const [phase, setPhase] = useState<Phase>("idle");

  useImperativeHandle(ref, () => ({
    trigger: () => void handleClick(),
  }));

  async function handleClick() {
    if (phase !== "idle" || disabled) return;
    setPhase("driving");
    const MIN_DRIVE_MS = 1250;
    try {
      const [ok] = await Promise.all([
        onSubmit(),
        new Promise<void>((r) => setTimeout(r, MIN_DRIVE_MS)),
      ]);
      if (ok) {
        setPhase("success");
        await new Promise((r) => setTimeout(r, 850));
        onSuccessShown();
      } else {
        setPhase("idle");
      }
    } catch {
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      aria-live="polite"
      className="nn-order-btn relative mt-5 h-12 w-full overflow-hidden rounded-full bg-terra font-semibold text-cream hover:bg-terra-dark disabled:opacity-70"
    >
      <span className={`nn-label ${phase !== "idle" ? "nn-label-hide" : ""}`}>
        {idleLabel}
      </span>

      {phase === "driving" && (
        <span className="nn-road" aria-hidden="true">
          <svg
            className="nn-truck"
            viewBox="0 0 64 32"
            width="46"
            height="23"
            fill="none"
          >
            {/* cargo box */}
            <rect x="4" y="7" width="34" height="18" rx="3" fill="#faf3e6" stroke="#2e1f14" strokeWidth="1.5" />
            <line x1="4" y1="14" x2="38" y2="14" stroke="#e7d9bd" strokeWidth="1.2" />
            {/* cab */}
            <path d="M38 11h11c2 0 3.6 1.3 4.4 3.1l2.6 5.9c.5 1.1-.3 2-1.4 2H38V11z" fill="#9e3115" stroke="#2e1f14" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M41 13.5h6.5c1 0 1.9.7 2.3 1.6l1.1 2.4h-9.9v-4z" fill="#c2401f" />
            {/* headlight beams */}
            <path className="nn-beam" d="M56 15 L63 12 L58 17 Z" fill="#eecb7a" />
            <path className="nn-beam nn-beam-2" d="M56 19 L63 22 L58 17 Z" fill="#eecb7a" />
            {/* wheels */}
            <circle cx="13" cy="26" r="3.2" fill="#2e1f14" />
            <circle cx="13" cy="26" r="1.1" fill="#6b5744" />
            <circle cx="45" cy="26" r="3.2" fill="#2e1f14" />
            <circle cx="45" cy="26" r="1.1" fill="#6b5744" />
          </svg>
          <span className="nn-dashes" />
        </span>
      )}

      {phase === "success" && (
        <span className="nn-label nn-success-in flex items-center justify-center gap-2">
          Order placed
          <svg
            className="nn-check"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
          >
            <path
              d="M5 12.5 9.5 17 19 7"
              stroke="#8fd19e"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      <style>{`
        .nn-order-btn { -webkit-tap-highlight-color: transparent; }
        .nn-label { display: inline-block; transition: opacity .15s ease; }
        .nn-label-hide { opacity: 0; }
        .nn-road { position: absolute; inset: 0; display: block; }
        .nn-dashes {
          position: absolute; left: 8%; right: 8%; top: 50%;
          height: 2px; margin-top: -1px;
          background-image: linear-gradient(90deg, rgba(250,243,230,.55) 0 10px, transparent 10px 22px);
          background-size: 22px 2px;
          animation: nn-dash-move 1.25s linear forwards;
          opacity: 0;
        }
        .nn-truck {
          position: absolute; top: 50%; left: -18%;
          transform: translate(0, -50%);
          animation: nn-drive 1.25s cubic-bezier(.4,.05,.3,1) forwards;
        }
        .nn-beam { opacity: .85; animation: nn-flicker 0.35s ease-in-out infinite alternate; }
        .nn-beam-2 { animation-delay: .12s; }
        @keyframes nn-drive {
          0%   { left: -18%; }
          8%   { left: -10%; }
          85%  { left: 108%; }
          100% { left: 128%; }
        }
        @keyframes nn-dash-move {
          0% { opacity: 0; background-position: 0 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; background-position: -220px 0; }
        }
        @keyframes nn-flicker { from { opacity: .55; } to { opacity: 1; } }
        .nn-success-in { animation: nn-success-in .35s ease-out both; }
        @keyframes nn-success-in {
          0% { opacity: 0; transform: translateY(4px) scale(.96); }
          100% { opacity: 1; transform: none; }
        }
        .nn-check { animation: nn-check-pop .3s ease-out .15s both; }
        @keyframes nn-check-pop {
          0% { opacity: 0; transform: scale(.5); }
          70% { transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nn-truck, .nn-dashes, .nn-beam, .nn-success-in, .nn-check { animation: none; }
          .nn-truck { display: none; }
          .nn-dashes { opacity: 0; }
        }
      `}</style>
    </button>
  );
});

export default PlaceOrderButton;
