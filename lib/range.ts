import type { DateRange } from "./types";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

// Default reporting window for the dashboard.
export function lastNDays(days = 30): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { start: fmt(start), end: fmt(end), days };
}

// The window of the same length immediately preceding `range`, used as the
// baseline for period-over-period deltas. For "last 30 days" this is the 30
// days before it: [start - days, start - 1].
export function previousPeriod(range: DateRange): DateRange {
  const prevEnd = new Date(`${range.start}T00:00:00Z`);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (range.days - 1));
  return { start: fmt(prevStart), end: fmt(prevEnd), days: range.days };
}
