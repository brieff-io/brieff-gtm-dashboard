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
