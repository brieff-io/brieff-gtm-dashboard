import { unstable_cache } from "next/cache";
import { lastNDays, previousPeriod } from "./range";
import { getGa4Metrics } from "./ga4";
import { getHubSpotMetrics } from "./hubspot";
import { getStripeMetrics } from "./stripe";
import { getBigQueryInsights } from "./bigquery";
import type { DashboardData, FunnelStage } from "./types";

// External data is fetched at most once per REVALIDATE_SECONDS and then served
// from Next's data cache (see the cached export below). Opening or refreshing
// the dashboard repeatedly will not re-hit GA4/HubSpot/Stripe. Tune for fresher
// data vs. fewer API calls.
const REVALIDATE_SECONDS = 600;

// Fetches all three sources in parallel and assembles the cross-source GTM
// funnel. Each fetcher fails soft (status: not_configured / error), so the
// dashboard always renders.
async function fetchDashboardData(days: number): Promise<DashboardData> {
  const range = lastNDays(days);
  const prev = previousPeriod(range);
  const [ga4, hubspot, stripe, bigquery] = await Promise.all([
    getGa4Metrics(range, prev),
    getHubSpotMetrics(range, prev),
    getStripeMetrics(range, prev),
    getBigQueryInsights(range),
  ]);

  // A stage is only "available" if its source actually returned ok. Otherwise
  // the UI shows "—" so an errored fetch can't masquerade as a real zero.
  const ga4Ok = ga4.status === "ok";
  const hubspotOk = hubspot.status === "ok";
  const funnel: FunnelStage[] = [
    { label: "Visitors", value: ga4.sessions, source: "GA4 sessions", available: ga4Ok },
    { label: "Demo clicks", value: ga4.demoClicks, source: "GA4 demo_click", available: ga4Ok },
    { label: "New contacts", value: hubspot.newContacts, source: "HubSpot", available: hubspotOk },
    { label: "Deals created", value: hubspot.dealsCreated, source: "HubSpot", available: hubspotOk },
    { label: "Customers won", value: hubspot.wonDeals, source: "HubSpot", available: hubspotOk },
  ];

  return {
    range,
    ga4,
    hubspot,
    stripe,
    funnel,
    bigquery,
    fetchedAt: new Date().toISOString(),
  };
}

// Cached wrapper: repeated requests reuse the cached result until it goes stale,
// capping external API usage regardless of how often the dashboard is viewed.
export const getDashboardData = unstable_cache(
  fetchDashboardData,
  ["gtm-dashboard-data"],
  { revalidate: REVALIDATE_SECONDS },
);
