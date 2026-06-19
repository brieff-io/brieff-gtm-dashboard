// Shared data contracts for the GTM dashboard. Each source fetcher returns one
// of these shapes; the funnel + UI consume them. `status` lets the UI show a
// "connect this source" state when a credential isn't configured yet, so the
// app builds and runs before all keys are in place.

export type SourceStatus = "ok" | "not_configured" | "error";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  days: number;
}

export interface Ga4Metrics {
  status: SourceStatus;
  error?: string;
  sessions: number;
  users: number;
  newUsers: number;
  demoClicks: number; // demo_click
  leads: number; // generate_lead
  newsletterSignups: number; // newsletter_signup
  videoPlays: number; // video_start
  byChannel: { channel: string; sessions: number }[];
  timeseries: { date: string; sessions: number }[];
}

export interface HubSpotMetrics {
  status: SourceStatus;
  error?: string;
  newContacts: number; // created in range
  byLifecycle: { stage: string; count: number }[];
  dealsCreated: number; // created in range
  openDeals: number;
  pipelineValue: number; // sum of open deal amounts
  wonDeals: number; // closed-won in range
  wonValue: number; // sum of closed-won amounts in range
  byDealStage: { stage: string; count: number; amount: number }[];
}

export interface StripeMetrics {
  status: SourceStatus;
  error?: string;
  mrr: number; // blended MRR in base currency (AUD): discounts + live FX applied
  mrrByCurrency: { currency: string; mrr: number }[]; // native per-currency, discount-adjusted
  activeSubscriptions: number; // paying subscriptions (excludes $0/free), matches Stripe
  newCustomers: number; // created in range
  currency: string; // base currency code, e.g. "aud"
}

export interface FunnelStage {
  label: string;
  value: number;
  source: string;
  // False when the underlying source errored/wasn't configured, so the UI can
  // show "unavailable" instead of a misleading 0 (a failed fetch must not read
  // as "no pipeline").
  available: boolean;
}

export interface DashboardData {
  range: DateRange;
  ga4: Ga4Metrics;
  hubspot: HubSpotMetrics;
  stripe: StripeMetrics;
  funnel: FunnelStage[];
  fetchedAt: string; // ISO time the source data was actually fetched (pre-cache)
}
