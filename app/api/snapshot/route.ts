import { NextResponse } from "next/server";
import { lastNDays, previousPeriod } from "@/lib/range";
import { getStripeMetrics } from "@/lib/stripe";
import { writeSnapshot } from "@/lib/snapshots";

// Daily revenue snapshot, invoked by Vercel Cron (see vercel.json). Records
// current MRR / active subscribers / trials into BigQuery so the dashboard can
// chart them over time. Protected by CRON_SECRET — Vercel sends it as a Bearer
// token automatically when the env var is set; refuse otherwise.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const range = lastNDays(30);
  const stripe = await getStripeMetrics(range, previousPeriod(range));
  if (stripe.status !== "ok") {
    return NextResponse.json(
      { error: `stripe ${stripe.status}`, detail: stripe.error },
      { status: 502 },
    );
  }

  const point = {
    mrr: stripe.mrr,
    activeSubscribers: stripe.activeSubscriptions,
    trials: stripe.trials.length,
    currency: stripe.currency,
  };

  try {
    await writeSnapshot(point);
  } catch (e) {
    return NextResponse.json(
      { error: "snapshot write failed", detail: (e as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, point });
}
