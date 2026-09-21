import Link from "next/link";

/**
 * Nutty Nirvana corner mark: a white N on a dark disc, its right stroke and
 * diagonal fading out, matching the look Vikram picked. Used as the corner badge on every page and,
 * as a static copy, in src/app/icon.svg for the browser tab.
 */
export function NnMark({ size = 48 }: { size?: number | string }) {
  return (
    <svg viewBox="0 0 180 180" width={size} height={size} role="img" aria-label="Nutty Nirvana">
      <defs>
        <linearGradient id="nn-mark-a" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="nn-mark-b" x1="121" y1="54" x2="120.8" y2="106.9" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="nn-mark-c">
          <circle cx="90" cy="90" r="84" />
        </clipPath>
      </defs>
      <circle cx="90" cy="90" r="89" fill="#1a1a18" />
      <circle cx="90" cy="90" r="84" fill="#34332e" />
      <circle cx="90" cy="90" r="80.5" fill="none" stroke="#56554f" strokeWidth="3" />
      <g clipPath="url(#nn-mark-c)">
        <g transform="translate(90 90) scale(0.78) translate(-90 -90)">
        <path
          d="M149.5 157.5 69.1 54H54v72h12.1V69.4l73.9 95.4c3.3-2.2 6.5-4.7 9.5-7.3Z"
          fill="url(#nn-mark-a)"
        />
        <rect x="115" y="54" width="12" height="72" fill="url(#nn-mark-b)" />
        </g>
      </g>
    </svg>
  );
}

/** Fixed bottom-left badge on every page; links home. */
export default function NnCornerBadge() {
  return (
    <Link
      href="/"
      aria-label="Nutty Nirvana home"
      className="fixed bottom-5 left-5 z-40 rounded-full shadow-card transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
    >
      <NnMark size={48} />
    </Link>
  );
}
