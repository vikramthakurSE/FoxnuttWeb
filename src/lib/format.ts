const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  return inr.format(amount);
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
