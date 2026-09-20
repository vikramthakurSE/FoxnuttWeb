const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole rupees stay bare (₹1,200); anything with paise shows both digits (₹12.50). */
export function formatINR(amount: number): string {
  return Number.isInteger(Math.round(amount * 100) / 100)
    ? inr.format(amount)
    : inrPaise.format(amount);
}

/** Whole-number discount off the MRP, or 0 when there's nothing to show. */
export function discountPercent(mrp: number, price: number): number {
  if (!mrp || mrp <= price) return 0;
  return Math.round((1 - price / mrp) * 100);
}

export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(2)} kg`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
