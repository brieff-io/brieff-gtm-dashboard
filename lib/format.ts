export const fmtNum = (n: number): string =>
  new Intl.NumberFormat("en-AU").format(Math.round(n || 0));

export const fmtCurrency = (n: number, currency = "aud"): string =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(n || 0);

export const pct = (numerator: number, denominator: number): string =>
  denominator > 0 ? `${((numerator / denominator) * 100).toFixed(1)}%` : "—";

// Compact "time since" for the data-freshness label. Computed at render time
// from the (cached) fetch timestamp, so it reflects how stale the data is.
export const fmtRelativeTime = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};
