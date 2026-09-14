/**
 * The loader shown wherever the site is waiting on the backend.
 * Inherits the text colour, so it works on dark buttons and light cards.
 */
export default function Spinner({
  size = 18,
  label,
  className = "",
}: {
  size?: number;
  /** Read by screen readers; omit when visible text already says it. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.15em] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Spinner + text, for buttons that are busy. */
export function BusyLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Spinner size={16} />
      {children}
    </span>
  );
}
