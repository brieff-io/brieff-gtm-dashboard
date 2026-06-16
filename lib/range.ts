import type { DateRange } from "./types";

// Default reporting window for the dashboard.
export function lastNDays(days = 30): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), days };
}
