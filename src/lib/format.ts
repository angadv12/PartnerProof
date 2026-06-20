/** Pure date / number / string formatting helpers (safe on client and server). */

/** Treat date-only values ("YYYY-MM-DD") as local midnight to avoid TZ drift. */
function parseDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

export function formatCurrency(value?: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(value?: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return parseDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  return parseDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Whole-day difference between `iso` and `from` (negative when overdue). */
export function daysUntil(iso: string, from: Date = new Date()): number {
  const due = parseDate(iso);
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function relativeDueLabel(iso?: string | null): string {
  if (!iso) return "No due date";
  const d = daysUntil(iso);
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d > 0) return `Due in ${d} days`;
  if (d === -1) return "Overdue by 1 day";
  return `Overdue by ${Math.abs(d)} days`;
}

export function clampPercent(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
