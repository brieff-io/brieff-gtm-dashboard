import Stripe from "stripe";
import type { DateRange, StripeMetrics } from "./types";

// Stripe. Needs a restricted, read-only secret key in env STRIPE_SECRET_KEY.
// MRR is normalised from active subscriptions to a monthly figure.

const KEY = process.env.STRIPE_SECRET_KEY;

const EMPTY: StripeMetrics = {
  status: "not_configured",
  mrr: 0,
  activeSubscriptions: 0,
  newCustomers: 0,
  currency: "aud",
};

export async function getStripeMetrics(range: DateRange): Promise<StripeMetrics> {
  if (!KEY) return EMPTY;

  try {
    const stripe = new Stripe(KEY);

    let mrr = 0;
    let activeSubscriptions = 0;
    let currency = "";

    for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
      activeSubscriptions += 1;
      for (const item of sub.items.data) {
        const price = item.price;
        const qty = item.quantity ?? 1;
        if (!price.unit_amount || !price.recurring) continue;
        currency = currency || price.currency;
        const count = price.recurring.interval_count || 1;
        let monthly = price.unit_amount * qty;
        switch (price.recurring.interval) {
          case "year":
            monthly = monthly / (12 * count);
            break;
          case "week":
            monthly = (monthly * 52) / 12 / count;
            break;
          case "day":
            monthly = (monthly * 30) / count;
            break;
          default: // month
            monthly = monthly / count;
        }
        mrr += monthly;
      }
    }
    mrr = mrr / 100; // cents -> currency units

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
      mrr,
      activeSubscriptions,
      newCustomers,
      currency: currency || "aud",
    };
  } catch (e) {
    return { ...EMPTY, status: "error", error: (e as Error).message };
  }
}
