import Link from "next/link";

/**
 * Nutty Nirvana "NN" monogram: two linked N strokes on a dark disc, fading
 * from white into makhana gold. Used as the corner badge on every page and,
 * as a static copy, in src/app/icon.svg for the browser tab.
 */
export function NnMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Nutty Nirvana"
    >
      <defs>
        <linearGradient id="nn-mark-ink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f6ead2" />
          <stop offset="1" stopColor="#d9a95a" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#2b2724" />
      <circle cx="32" cy="32" r="28.5" fill="none" stroke="#5a534b" strokeWidth="1.5" />
      <path
        d="M16 43V21l13 22V21M35 43V21l13 22V21"
        fill="none"
        stroke="url(#nn-mark-ink)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Fixed bottom-left badge on every page; links home. */
export default function NnCornerBadge() {
  return (
    <Link
      href="/"
      aria-label="Nutty Nirvana home"
      className="fixed bottom-5 left-5 z-40 rounded-full shadow-card transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra"
    >
      <NnMark size={48} />
    </Link>
  );
}
