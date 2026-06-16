import { lastNDays } from "./range";
import { getGa4Metrics } from "./ga4";
import { getHubSpotMetrics } from "./hubspot";
import { getStripeMetrics } from "./stripe";
import type { DashboardData, FunnelStage } from "./types";

// Fetches all three sources in parallel and assembles the cross-source GTM
// funnel. Each fetcher fails soft (status: not_configured / error), so the
// dashboard always renders.
export async function getDashboardData(days = 30): Promise<DashboardData> {
  const range = lastNDays(days);
  const [ga4, hubspot, stripe] = await Promise.all([
    getGa4Metrics(range),
    getHubSpotMetrics(range),
    getStripeMetrics(range),
  ]);

  const funnel: FunnelStage[] = [
    { label: "Visitors", value: ga4.sessions, source: "GA4 sessions" },
    { label: "Demo clicks", value: ga4.demoClicks, source: "GA4 demo_click" },
    { label: "New contacts", value: hubspot.newContacts, source: "HubSpot" },
    { label: "Deals created", value: hubspot.dealsCreated, source: "HubSpot" },
    { label: "Customers won", value: hubspot.wonDeals, source: "HubSpot" },
  ];

  return { range, ga4, hubspot, stripe, funnel };
}
