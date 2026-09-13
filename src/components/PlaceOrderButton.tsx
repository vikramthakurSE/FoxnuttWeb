"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type Phase = "idle" | "loading" | "waiting" | "success";

/** Full truck choreography, in ms. Keep in step with the keyframe %s. */
const DRIVE_MS = 6400;
/** How long "Order placed ✓" stays before the page moves on. */
const SUCCESS_HOLD_MS = 1400;

export interface PlaceOrderButtonHandle {
  /** Lets the wrapping <form>'s Enter-to-submit trigger the same animation. */
  trigger: () => void;
}

/**
 * Checkout submit button with a delivery-truck animation:
 *
 *  1. the label fades and a parcel appears on the left
 *  2. the truck reverses in from the right with its rear doors open
 *  3. the parcel slides into the back, and the doors swing shut
 *  4. headlights on, the truck pulls away along a streaming road and exits
 *  5. "Order placed" fades in and the tick draws
 *
 * The order request runs in parallel. A failure (or the pay-first block)
 * stops the animation immediately and resets, so a rejected order never
 * gets a checkmark. A request slower than the animation holds on a quiet
 * "Placing order…" until it answers.
 */
const PlaceOrderButton = forwardRef<
  PlaceOrderButtonHandle,
  {
    idleLabel: string;
    disabled?: boolean;
    /** Does the real work; resolve true only once the order is placed. */
    onSubmit: () => Promise<boolean>;
    /** Called after the checkmark has been on screen a moment. */
    onSuccessShown: () => void;
  }
>(function PlaceOrderButton({ idleLabel, disabled, onSubmit, onSuccessShown }, ref) {
  const [phase, setPhase] = useState<Phase>("idle");
  // Bumped per run so React remounts the stage and the keyframes restart.
  const [run, setRun] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      timers.current.push(setTimeout(resolve, ms));
    });

  async function handleClick() {
    if (phase !== "idle" || disabled) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const driveMs = reduced ? 0 : DRIVE_MS;

    setRun((n) => n + 1);
    setPhase("loading");

    let animDone = false;
    let result: boolean | null = null;

    const settle = async () => {
      if (!alive.current) return;
      if (result === false) {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        setPhase("idle");
        return;
      }
      if (result === true && animDone) {
        setPhase("success");
        await wait(SUCCESS_HOLD_MS);
        if (alive.current) onSuccessShown();
        return;
      }
      if (animDone && result === null) setPhase("waiting");
    };

    void wait(driveMs).then(() => {
      animDone = true;
      void settle();
    });

    try {
      result = await onSubmit();
    } catch {
      result = false;
    }
    void settle();
  }

  useImperativeHandle(ref, () => ({ trigger: () => void handleClick() }));

  const active = phase !== "idle";
  const stageStyle = { "--nn-t": `${DRIVE_MS}ms` } as CSSProperties;

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled || active}
      aria-live="polite"
      aria-label={
        phase === "success"
          ? "Order placed"
          : active
            ? "Placing your order"
            : idleLabel
      }
      className={`nn-ob relative mt-5 h-14 w-full overflow-hidden rounded-full font-semibold text-cream ${
        active ? "nn-ob-active" : "bg-terra hover:bg-terra-dark"
      } ${disabled && !active ? "opacity-50" : ""}`}
    >
      <span className={`nn-ob-label ${active ? "nn-ob-label-out" : ""}`}>
        {idleLabel}
      </span>

      {phase === "loading" && (
        <span key={run} className="nn-stage" style={stageStyle} aria-hidden="true">
          <span className="nn-road" />
          <span className="nn-parcel">
            <span className="nn-parcel-tape" />
          </span>
          <span className="nn-truck">
            <span className="nn-door nn-door-top" />
            <span className="nn-door nn-door-bottom" />
            <span className="nn-box" />
            <span className="nn-cab">
              <span className="nn-glass" />
              <span className="nn-lamp nn-lamp-top" />
              <span className="nn-lamp nn-lamp-bottom" />
            </span>
            <span className="nn-beam nn-beam-top" />
            <span className="nn-beam nn-beam-bottom" />
          </span>
        </span>
      )}

      {phase === "waiting" && (
        <span className="nn-ob-center nn-fade-in text-sm text-cream/80">
          Placing order…
        </span>
      )}

      {phase === "success" && (
        <span className="nn-ob-center nn-fade-in gap-2">
          Order placed
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path
              className="nn-tick"
              d="M5 12.5 9.5 17 19 7"
              stroke="#4ade80"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      <style>{`
        .nn-ob { -webkit-tap-highlight-color: transparent; transition: background-color .35s ease; }
        .nn-ob-active { background: #1c1e27; }
        .nn-ob-label { position: relative; z-index: 1; display: inline-block; transition: opacity .3s ease, transform .3s ease; }
        .nn-ob-label-out { opacity: 0; transform: translateY(-4px); }
        .nn-ob-center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .nn-fade-in { animation: nn-fade-in .45s ease-out both; }
        @keyframes nn-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .nn-tick { stroke-dasharray: 24; stroke-dashoffset: 24; animation: nn-tick .4s ease-out .35s forwards; }
        @keyframes nn-tick { to { stroke-dashoffset: 0; } }

        .nn-stage { position: absolute; inset: 0; display: block; }

        /* Road: dashes stream left constantly; the master timeline only
           controls when the road is visible. */
        .nn-road {
          position: absolute; left: 0; right: 0; top: 50%; height: 2px; margin-top: -1px;
          background-image: linear-gradient(90deg, rgba(255,255,255,.85) 0 9px, transparent 9px 18px);
          background-size: 18px 2px;
          opacity: 0;
          animation: nn-road-show var(--nn-t) linear forwards, nn-road-scroll .35s linear infinite;
        }
        @keyframes nn-road-scroll { from { background-position: 0 0; } to { background-position: -18px 0; } }
        @keyframes nn-road-show {
          0%, 52% { opacity: 0; }
          58%, 90% { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Parcel: pops in on the left, then slides into the truck's back. */
        .nn-parcel {
          position: absolute; top: 50%; left: 7%; width: 26px; height: 24px; margin-top: -12px;
          border-radius: 3px;
          background: linear-gradient(180deg, #f0d08e, #d9a95a);
          box-shadow: inset 0 -2px 0 rgba(0,0,0,.12);
          opacity: 0;
          animation: nn-parcel var(--nn-t) linear forwards;
        }
        .nn-parcel-tape { position: absolute; left: 0; right: 0; top: 50%; height: 2px; margin-top: -1px; background: rgba(120,80,30,.35); }
        @keyframes nn-parcel {
          0%   { opacity: 0; transform: scale(.5); left: 7%; }
          6%   { opacity: 1; transform: scale(1); left: 7%; }
          27%  { opacity: 1; transform: scale(1); left: 7%; animation-timing-function: ease-in-out; }
          40%  { opacity: 1; transform: scale(.85); left: 19%; }
          43%  { opacity: 0; transform: scale(.7); left: 21%; }
          100% { opacity: 0; left: 21%; }
        }

        /* Truck (top-down, facing right). left: is the back of the box. */
        .nn-truck {
          position: absolute; top: 50%; left: 110%; width: 86px; height: 38px; margin-top: -19px;
          z-index: 2;
          animation: nn-truck var(--nn-t) linear forwards;
        }
        @keyframes nn-truck {
          0%   { left: 110%; animation-timing-function: cubic-bezier(.2,.6,.3,1); }
          24%  { left: 20%; }
          50%  { left: 20%; animation-timing-function: cubic-bezier(.4,0,.2,1); }
          58%  { left: 46%; animation-timing-function: ease-in-out; }
          68%  { left: 14%; animation-timing-function: ease-in-out; }
          86%  { left: 20%; animation-timing-function: cubic-bezier(.6,0,.9,.4); }
          96%  { left: 115%; }
          100% { left: 115%; }
        }
        .nn-box {
          position: absolute; left: 0; top: 1px; width: 56px; height: 36px; border-radius: 4px;
          background: linear-gradient(180deg, #ffffff 0%, #dfe4f2 100%);
          box-shadow: 0 1px 2px rgba(0,0,0,.35);
        }
        .nn-cab {
          position: absolute; left: 59px; top: 1px; width: 22px; height: 36px;
          border-radius: 3px 12px 12px 3px;
          background: #3b6cf6;
        }
        .nn-glass {
          position: absolute; left: 5px; top: 5px; right: 4px; bottom: 5px;
          border-radius: 1px 8px 8px 1px; background: #151722;
          box-shadow: inset 3px -3px 0 -2px rgba(255,255,255,.18);
        }
        .nn-lamp { position: absolute; right: 0; width: 3px; height: 6px; border-radius: 1px; background: #f5d565; }
        .nn-lamp-top { top: 4px; }
        .nn-lamp-bottom { bottom: 4px; }

        /* Headlight beams, off until the doors are shut. */
        .nn-beam {
          position: absolute; left: 80px; width: 48px; height: 22px;
          background: radial-gradient(ellipse at 0% 50%, rgba(245,213,101,.9), rgba(245,213,101,0) 70%);
          clip-path: polygon(0 40%, 100% 0, 100% 100%, 0 60%);
          filter: blur(.5px);
          opacity: 0;
          animation: nn-beam var(--nn-t) linear forwards;
        }
        .nn-beam-top { top: -4px; }
        .nn-beam-bottom { bottom: -4px; }
        @keyframes nn-beam {
          0%, 50% { opacity: 0; }
          54%, 92% { opacity: 1; }
          96%, 100% { opacity: 0; }
        }

        /* Rear doors hinge on the back corners of the box. Each is a bar
           pointing left from its hinge: open = swung outward, closed = lying
           along the back edge. */
        .nn-door {
          position: absolute; left: -19px; width: 20px; height: 2px; border-radius: 1px;
          background: #ffffff; transform-origin: 100% 50%;
        }
        .nn-door-top { top: 1px; animation: nn-door-top var(--nn-t) linear forwards; }
        .nn-door-bottom { top: 35px; animation: nn-door-bottom var(--nn-t) linear forwards; }
        @keyframes nn-door-top {
          0%, 41% { transform: rotate(32deg); opacity: 1; }
          49%     { transform: rotate(-90deg); opacity: 1; }
          51%, 100% { transform: rotate(-90deg); opacity: 0; }
        }
        @keyframes nn-door-bottom {
          0%, 41% { transform: rotate(-32deg); opacity: 1; }
          49%     { transform: rotate(90deg); opacity: 1; }
          51%, 100% { transform: rotate(90deg); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nn-stage { display: none; }
        }
      `}</style>
    </button>
  );
});

export default PlaceOrderButton;
