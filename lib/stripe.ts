import Stripe from "stripe";
import type { DateRange, StripeMetrics } from "./types";

// Stripe. Needs a restricted, read-only secret key in env STRIPE_SECRET_KEY.
// MRR is computed per currency from active subscriptions and normalised to a
// monthly figure. Tiered prices (unit_amount is null) are valued by evaluating
// their tiers against the subscription quantity; metered usage is excluded
// because it can't be known without usage data. Currencies are never summed.

const KEY = process.env.STRIPE_SECRET_KEY;

const EMPTY: StripeMetrics = {
  status: "not_configured",
  mrr: 0,
  mrrByCurrency: [],
  activeSubscriptions: 0,
  newCustomers: 0,
  currency: "aud",
};

// Normalise a recurring amount (minor units) to a monthly amount.
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
  // graduated: charge each tier band the quantity passes through.
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

export async function getStripeMetrics(range: DateRange): Promise<StripeMetrics> {
  if (!KEY) return EMPTY;

  try {
    const stripe = new Stripe(KEY);

    // Tiered prices don't include their tiers by default; fetch once per price
    // id and cache (subscriptions commonly share a price).
    const priceCache = new Map<string, Stripe.Price>();
    const priceWithTiers = async (id: string): Promise<Stripe.Price> => {
      const cached = priceCache.get(id);
      if (cached) return cached;
      const p = await stripe.prices.retrieve(id, { expand: ["tiers"] });
      priceCache.set(id, p);
      return p;
    };

    const monthlyByCurrency: Record<string, number> = {};
    let activeSubscriptions = 0;

    for await (const sub of stripe.subscriptions.list({
      status: "active",
      limit: 100,
    })) {
      activeSubscriptions += 1;
      for (const item of sub.items.data) {
        const price = item.price;
        const rec = price.recurring;
        if (!rec) continue;
        const qty = item.quantity ?? 1;

        let amount: number; // minor units, per billing period
        if (price.billing_scheme === "tiered") {
          // Usage-based tiers can't be valued without usage data.
          if (rec.usage_type === "metered") continue;
          const full = await priceWithTiers(price.id);
          amount = tierAmount(full.tiers ?? [], full.tiers_mode, qty);
        } else if (price.unit_amount != null) {
          amount = price.unit_amount * qty;
        } else {
          continue;
        }
        if (!amount) continue;

        monthlyByCurrency[price.currency] =
          (monthlyByCurrency[price.currency] || 0) +
          toMonthly(amount, rec.interval, rec.interval_count);
      }
    }

    // Per-currency MRR (minor units -> currency units), largest first. Different
    // currencies are NOT summed; the primary is the largest.
    const mrrByCurrency = Object.entries(monthlyByCurrency)
      .map(([currency, minor]) => ({ currency, mrr: minor / 100 }))
      .sort((a, b) => b.mrr - a.mrr);
    const primary = mrrByCurrency[0];

    const startSec = Math.floor(
      new Date(`${range.start}T00:00:00Z`).getTime() / 1000,
    );
    let newCustomers = 0;
    for await (const _c of stripe.customers.list({
      created: { gte: startSec },
      limit: 100,
    })) {
      void _c;
      newCustomers += 1;
    }

    return {
      status: "ok",
      mrr: primary?.mrr ?? 0,
      mrrByCurrency,
      activeSubscriptions,
      newCustomers,
      currency: primary?.currency ?? "aud",
    };
  } catch (e) {
    return { ...EMPTY, status: "error", error: (e as Error).message };
  }
}
