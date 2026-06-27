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

// Headline traffic stats for one audience segment (all / new / returning), so the
// dashboard can switch between raw totals and a prospects-only view.
export interface AudienceStats {
  sessions: number;
  users: number;
  engagedSessions: number;
  engagementRate: number; // 0..1
  bounceRate: number; // 0..1
}

// Windowed (flow) metrics carry their prior-period value so the UI can show a
// period-over-period delta. Point-in-time metrics (MRR, open pipeline, lifecycle
// totals) have no prior value here — they need historical snapshots, not a
// second range query — so they're deliberately left out of `previous`.
// All GA4 figures are filtered to the production host (excludes dev/preview),
// and sign-ins alias the old + new event names into one series.
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
  host: string; // production host the GA4 data is filtered to
  audience: { all: AudienceStats; new: AudienceStats; returning: AudienceStats };
  signIns: number; // login_click + legacy click_button_signin_navbar (existing-customer intent)
  demoByPage: { page: string; count: number }[]; // where demo CTAs are clicked
  demoByChannel: { channel: string; count: number }[];
  trend: { week: string; demo: number; signin: number }[]; // weekly, ISO-week start
  previous: {
    sessions: number;
    users: number;
    newUsers: number;
    demoClicks: number;
    leads: number;
    newsletterSignups: number;
    videoPlays: number;
    signIns: number;
  };
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
  previous: {
    newContacts: number;
    dealsCreated: number;
    wonDeals: number;
  };
}

// A subscription currently in its trial — the pipeline stage just before paid.
// Brieff's model is demo → 14-day trial → paid, so these are live conversion
// opportunities (who to follow up with).
export interface TrialAccount {
  name: string;
  email: string;
  plan: string; // e.g. "GBP / month"
  daysLeft: number; // until trial_end
}

export interface StripeMetrics {
  status: SourceStatus;
  error?: string;
  mrr: number; // blended MRR in base currency (AUD): discounts + live FX applied
  mrrByCurrency: { currency: string; mrr: number }[]; // native per-currency, discount-adjusted
  activeSubscriptions: number; // paying subscriptions (excludes $0/free), matches Stripe
  newCustomers: number; // created in range = new signups/trials (customer is created at trial start)
  paidConversions: number; // trials that converted to paid in range (active, trial_end in window)
  trials: TrialAccount[]; // currently trialing accounts
  currency: string; // base currency code, e.g. "aud"
  previous: {
    newCustomers: number;
  };
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

// GA4 → BigQuery event-level export (true journey/path/funnel analysis the Data
// API can't do). `pending` = export linked but the first daily tables haven't
// landed yet (~24h after linking); the section stays quiet until real data.
export interface BigQueryInsights {
  status: "ok" | "not_configured" | "error" | "pending";
  error?: string;
  recentEvents: number;
  recentUsers: number;
}

// One day's recorded revenue state. MRR/ARR/subscribers/trials are point-in-time,
// so a daily cron snapshots them into BigQuery to build a real trend over time.
export interface SnapshotPoint {
  date: string; // YYYY-MM-DD
  mrr: number;
  activeSubscribers: number;
  trials: number;
}

export interface DashboardData {
  range: DateRange;
  ga4: Ga4Metrics;
  hubspot: HubSpotMetrics;
  stripe: StripeMetrics;
  funnel: FunnelStage[];
  bigquery: BigQueryInsights;
  mrrTrend: SnapshotPoint[]; // daily revenue snapshots (empty until they accrue)
  fetchedAt: string; // ISO time the source data was actually fetched (pre-cache)
}
