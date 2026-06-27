import Stripe from "stripe";
import type { DateRange, StripeMetrics, TrialAccount } from "./types";

// Stripe. Needs a restricted, read-only secret key in env STRIPE_SECRET_KEY.
// MRR is computed per subscription (tiered prices evaluated, coupon discounts
// applied), then blended into a single base-currency figure (AUD) using live
// ECB rates, so it lines up with Stripe's own dashboard MRR. activeSubscriptions
// counts PAYING subscriptions (excludes $0/free), matching Stripe's "Active
// subscribers". Base currency and fallback FX rates are configurable via env:
//   DASHBOARD_BASE_CURRENCY   default "aud"
//   FX_<CUR>_<BASE>           fallback rate if the live FX lookup fails

const KEY = process.env.STRIPE_SECRET_KEY;
const BASE = (process.env.DASHBOARD_BASE_CURRENCY || "aud").toLowerCase();

const EMPTY: StripeMetrics = {
  status: "not_configured",
  mrr: 0,
  mrrByCurrency: [],
  activeSubscriptions: 0,
  newCustomers: 0,
  paidConversions: 0,
  trials: [],
  currency: BASE,
  previous: { newCustomers: 0 },
};

function toMonthly(
  amount: number,
  interval: Stripe.Price.Recurring["interval"],
  intervalCount: number | null | undefined,
): number {
  const c = intervalCount || 1;
  switch (interval) {
    case "year":
      return amount / (12 * c);
    case "week":
      return (amount * 52) / 12 / c;
    case "day":
      return (amount * 30) / c;
    default: // month
      return amount / c;
  }
}

// Value a tiered price for a licensed quantity (returns minor units).
function tierAmount(
  tiers: Stripe.Price.Tier[],
  mode: Stripe.Price["tiers_mode"],
  quantity: number,
): number {
  const norm = tiers.map((t) => ({
    upTo: t.up_to == null ? Infinity : t.up_to,
    unit:
      t.unit_amount != null ? t.unit_amount : parseFloat(t.unit_amount_decimal || "0"),
    flat:
      t.flat_amount != null ? t.flat_amount : parseFloat(t.flat_amount_decimal || "0"),
  }));
  if (mode === "volume") {
    const tier = norm.find((t) => quantity <= t.upTo) ?? norm[norm.length - 1];
    return tier ? tier.unit * quantity + tier.flat : 0;
  }
  let remaining = quantity;
  let lastUpTo = 0;
  let total = 0;
  for (const t of norm) {
    const band = Math.min(remaining, t.upTo - lastUpTo);
    if (band > 0) {
      total += band * t.unit + t.flat;
      remaining -= band;
    }
    lastUpTo = t.upTo;
    if (remaining <= 0) break;
  }
  return total;
}

// Apply ongoing coupon discounts (forever/repeating) to a monthly amount.
function applyDiscounts(
  monthly: number,
  discounts: (string | Stripe.Discount)[] | undefined,
  currency: string,
): number {
  let result = monthly;
  for (const d of discounts ?? []) {
    if (typeof d === "string") continue; // unexpanded id, can't value
    const coupon = d.coupon;
    if (!coupon || coupon.duration === "once") continue;
    if (coupon.percent_off) {
      result -= (result * coupon.percent_off) / 100;
    } else if (coupon.amount_off && (!coupon.currency || coupon.currency === currency)) {
      result -= coupon.amount_off;
    }
  }
  return Math.max(0, result);
}

// Live ECB rates -> base-currency units per 1 unit of each currency. Falls back
// to FX_<CUR>_<BASE> env vars, else 0 (that currency is excluded from the blend).
async function ratesToBase(currencies: string[]): Promise<Record<string, number>> {
  const rates: Record<string, number> = { [BASE]: 1 };
  const foreign = currencies.filter((c) => c !== BASE);
  if (!foreign.length) return rates;
  try {
    const url = `https://api.frankfurter.app/latest?from=${BASE.toUpperCase()}&to=${foreign
      .map((c) => c.toUpperCase())
      .join(",")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`fx http ${res.status}`);
    const json = (await res.json()) as { rates?: Record<string, number> };
    for (const [cur, r] of Object.entries(json.rates ?? {})) {
      if (r) rates[cur.toLowerCase()] = 1 / Number(r); // 1 foreign = (1/r) base
    }
  } catch {
    // fall back to configured fixed rates; unknown currencies stay excluded.
    for (const c of foreign) {
      const v = process.env[`FX_${c.toUpperCase()}_${BASE.toUpperCase()}`];
      rates[c] = v ? Number(v) : 0;
    }
  }
  return rates;
}

export async function getStripeMetrics(
  range: DateRange,
  prev: DateRange,
): Promise<StripeMetrics> {
  if (!KEY) return EMPTY;

  try {
    const stripe = new Stripe(KEY);

    const priceCache = new Map<string, Stripe.Price>();
    const priceWithTiers = async (id: string): Promise<Stripe.Price> => {
      const cached = priceCache.get(id);
      if (cached) return cached;
      const p = await stripe.prices.retrieve(id, { expand: ["tiers"] });
      priceCache.set(id, p);
      return p;
    };

    const startSec = Math.floor(
      new Date(`${range.start}T00:00:00Z`).getTime() / 1000,
    );
    const prevStartSec = Math.floor(
      new Date(`${prev.start}T00:00:00Z`).getTime() / 1000,
    );
    const nowSec = Math.floor(Date.now() / 1000);

    const nativeByCurrency: Record<string, number> = {};
    let activeSubscriptions = 0; // paying subscriptions, matches Stripe
    let paidConversions = 0; // paying subs whose trial ended in range (trial → paid)

    for await (const sub of stripe.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.discounts"],
    })) {
      let subMonthly = 0;
      let currency: string | null = null;
      for (const item of sub.items.data) {
        const price = item.price;
        const rec = price.recurring;
        if (!rec) continue;
        const qty = item.quantity ?? 1;

        let amount: number;
        if (price.billing_scheme === "tiered") {
          if (rec.usage_type === "metered") continue;
          const full = await priceWithTiers(price.id);
          amount = tierAmount(full.tiers ?? [], full.tiers_mode, qty);
        } else if (price.unit_amount != null) {
          amount = price.unit_amount * qty;
        } else {
          continue;
        }
        if (!amount) continue;
        currency = price.currency;
        subMonthly += toMonthly(amount, rec.interval, rec.interval_count);
      }

      if (currency) subMonthly = applyDiscounts(subMonthly, sub.discounts, currency);

      if (subMonthly > 0 && currency) {
        activeSubscriptions += 1;
        nativeByCurrency[currency] = (nativeByCurrency[currency] || 0) + subMonthly;
        // Now-paying sub whose trial ended within the window = converted in range.
        if (sub.trial_end && sub.trial_end >= startSec && sub.trial_end <= nowSec) {
          paidConversions += 1;
        }
      }
    }

    // Native per-currency MRR (largest first) + a single blended base-currency MRR.
    const mrrByCurrency = Object.entries(nativeByCurrency)
      .map(([currency, minor]) => ({ currency, mrr: minor / 100 }))
      .sort((a, b) => b.mrr - a.mrr);

    const rates = await ratesToBase(Object.keys(nativeByCurrency));
    let blended = 0;
    for (const [currency, minor] of Object.entries(nativeByCurrency)) {
      blended += (minor / 100) * (rates[currency] ?? 0);
    }

    let newCustomers = 0;
    for await (const _c of stripe.customers.list({
      created: { gte: startSec },
      limit: 100,
    })) {
      void _c;
      newCustomers += 1;
    }

    // Customers created in the previous window [prevStart, start) for the delta.
    let prevNewCustomers = 0;
    for await (const _c of stripe.customers.list({
      created: { gte: prevStartSec, lt: startSec },
      limit: 100,
    })) {
      void _c;
      prevNewCustomers += 1;
    }

    // Currently trialing accounts — the live pipeline stage before paid (who to
    // follow up with).
    const trials: TrialAccount[] = [];
    for await (const sub of stripe.subscriptions.list({
      status: "trialing",
      limit: 100,
      expand: ["data.customer"],
    })) {
      const c = sub.customer;
      const customer =
        c && typeof c !== "string" && !(c as Stripe.DeletedCustomer).deleted
          ? (c as Stripe.Customer)
          : null;
      const price = sub.items.data[0]?.price;
      trials.push({
        name: customer?.name || customer?.email || "(unknown)",
        email: customer?.email || "",
        plan: price
          ? `${price.currency.toUpperCase()} / ${price.recurring?.interval ?? "—"}`
          : "—",
        daysLeft: sub.trial_end
          ? Math.max(0, Math.round((sub.trial_end - nowSec) / 86400))
          : 0,
      });
    }
    trials.sort((a, b) => a.daysLeft - b.daysLeft); // soonest-ending first

    return {
      status: "ok",
      mrr: Math.round(blended * 100) / 100,
      mrrByCurrency,
      activeSubscriptions,
      newCustomers,
      paidConversions,
      trials,
      currency: BASE,
      previous: { newCustomers: prevNewCustomers },
    };
  } catch (e) {
    return { ...EMPTY, status: "error", error: (e as Error).message };
  }
}
