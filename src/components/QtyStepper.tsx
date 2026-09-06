"use client";

export default function QtyStepper({
  value,
  min = 1,
  max,
  onChange,
  small = false,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  small?: boolean;
}) {
  const btn = small
    ? "h-8 w-8 text-base"
    : "h-10 w-10 text-lg";
  const clamp = (v: number) => {
    let x = Math.max(min, Math.round(v) || min);
    if (max !== undefined) x = Math.min(max, x);
    return x;
  };
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-card overflow-hidden">
      <button
        type="button"
        aria-label="Decrease quantity"
        className={`${btn} font-bold text-ink-soft hover:bg-cream-2 disabled:opacity-30`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <span
        className={`${small ? "w-8 text-sm" : "w-10"} text-center font-semibold tabular-nums`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        className={`${btn} font-bold text-ink-soft hover:bg-cream-2 disabled:opacity-30`}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </div>
  );
}
