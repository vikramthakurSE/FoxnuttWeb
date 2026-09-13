"use client";

import type { ReactNode } from "react";

/** Animated "payment received" tick with a message and actions below. */
export default function PaymentSuccess({
  title = "Payment received",
  message,
  children,
}: {
  title?: string;
  message: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="nn-pop mt-6 rounded-2xl bg-card border border-leaf/40 shadow-card p-6 text-center">
      <div className="relative mx-auto h-24 w-24">
        <span className="nn-ring absolute inset-0 rounded-full bg-leaf/20" />
        <span className="nn-ring nn-ring-2 absolute inset-0 rounded-full bg-leaf/15" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-leaf text-cream shadow-card">
          <svg viewBox="0 0 52 52" className="h-12 w-12" aria-hidden="true">
            <path
              className="nn-tick"
              d="M14 27 L23 35 L39 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <h2 className="nn-rise mt-5 font-display text-2xl font-bold text-leaf">
        {title}
      </h2>
      <p className="nn-rise nn-delay-1 mt-2 text-sm text-ink-soft">{message}</p>
      {children && <div className="nn-rise nn-delay-2 mt-6">{children}</div>}
      <style>{`
        @keyframes nn-pop { 0% { opacity: 0; transform: scale(.94) translateY(8px); } 100% { opacity: 1; transform: none; } }
        @keyframes nn-tick { to { stroke-dashoffset: 0; } }
        @keyframes nn-ring { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(1.9); opacity: 0; } }
        @keyframes nn-rise { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: none; } }
        .nn-pop { animation: nn-pop .45s cubic-bezier(.2,.8,.2,1) both; }
        .nn-tick { stroke-dasharray: 48; stroke-dashoffset: 48; animation: nn-tick .5s ease-out .35s forwards; }
        .nn-ring { animation: nn-ring 1.4s ease-out .3s infinite; }
        .nn-ring-2 { animation-delay: .8s; }
        .nn-rise { animation: nn-rise .4s ease-out both; animation-delay: .5s; }
        .nn-delay-1 { animation-delay: .65s; }
        .nn-delay-2 { animation-delay: .8s; }
        @media (prefers-reduced-motion: reduce) {
          .nn-pop, .nn-tick, .nn-ring, .nn-rise { animation: none; }
          .nn-tick { stroke-dashoffset: 0; }
          .nn-ring { display: none; }
        }
      `}</style>
    </div>
  );
}
