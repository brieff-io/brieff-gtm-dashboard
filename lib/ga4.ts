import { BetaAnalyticsDataClient, protos } from "@google-analytics/data";
import type { DateRange, Ga4Metrics, AudienceStats } from "./types";

// GA4 Data API. Needs a Google Cloud service account with the Analytics Data
// API enabled, granted Viewer on the GA4 property. Configure via env:
//   GA_PROPERTY_ID   numeric property id (e.g. 313410833)
//   GA_CLIENT_EMAIL  service account email
//   GA_PRIVATE_KEY   service account private key (with \n escapes is fine)
//   GA_HOST          production host to filter to (default www.brieff.io)

const PROPERTY_ID = process.env.GA_PROPERTY_ID;
const CLIENT_EMAIL = process.env.GA_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Filter all reporting to the live marketing host so localhost/preview/bot
// traffic (which can't be excluded via our read-only service account) doesn't
// distort the numbers.
const HOST = process.env.GA_HOST || "www.brieff.io";

const FUNNEL_EVENTS = [
  "demo_click",
  "generate_lead",
  "newsletter_signup",
  "video_start",
];
// Demo is the gating conversion: book-a-demo CTA anywhere on the site.
const DEMO_EVENTS = ["demo_click", "click_button_bookdemo_footer"];
// Sign-in intent — aliases the old and current event names into one series so
// the mid-stream rename doesn't create a false cliff.
const SIGNIN_EVENTS = ["login_click", "click_button_signin_navbar"];

type FilterExpr = protos.google.analytics.data.v1beta.IFilterExpression;
const hostFilter: FilterExpr = {
  filter: {
    fieldName: "hostName",
    stringFilter: { matchType: "EXACT", value: HOST },
  },
};
const eventsFilter = (values: string[]): FilterExpr => ({
  filter: { fieldName: "eventName", inListFilter: { values } },
});
const allOf = (...expressions: FilterExpr[]): FilterExpr => ({
  andGroup: { expressions },
});

const EMPTY_AUDIENCE: AudienceStats = {
  sessions: 0,
  users: 0,
  engagedSessions: 0,
  engagementRate: 0,
  bounceRate: 0,
};

const EMPTY: Ga4Metrics = {
  status: "not_configured",
  sessions: 0,
  users: 0,
  newUsers: 0,
  demoClicks: 0,
  leads: 0,
  newsletterSignups: 0,
  videoPlays: 0,
  byChannel: [],
  timeseries: [],
  host: HOST,
  audience: { all: EMPTY_AUDIENCE, new: EMPTY_AUDIENCE, returning: EMPTY_AUDIENCE },
  signIns: 0,
  demoByPage: [],
  demoByChannel: [],
  trend: [],
  previous: {
    sessions: 0,
    users: 0,
    newUsers: 0,
    demoClicks: 0,
    leads: 0,
    newsletterSignups: 0,
    videoPlays: 0,
    signIns: 0,
  },
};

function num(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Bucket a GA4 date (YYYYMMDD) to the ISO week start (Monday), YYYY-MM-DD.
function weekStart(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export async function getGa4Metrics(
  range: DateRange,
  prev: DateRange,
): Promise<Ga4Metrics> {
  if (!PROPERTY_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return EMPTY;

  try {
    const client = new BetaAnalyticsDataClient({
      credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
    });
    const property = `properties/${PROPERTY_ID}`;
    const dateRanges = [{ startDate: range.start, endDate: range.end }];
    const prevRanges = [{ startDate: prev.start, endDate: prev.end }];

    // Totals carry traffic + engagement metrics so one query feeds both the
    // headline KPIs and the "all" audience card.
    const totalsReq = (dr: typeof dateRanges) => ({
      property,
      dateRanges: dr,
      dimensionFilter: hostFilter,
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "engagedSessions" },
        { name: "engagementRate" },
        { name: "bounceRate" },
      ],
    });
    const eventsReq = (dr: typeof dateRanges) => ({
      property,
      dateRanges: dr,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: allOf(hostFilter, eventsFilter(FUNNEL_EVENTS)),
    });
    const signInReq = (dr: typeof dateRanges) => ({
      property,
      dateRanges: dr,
      metrics: [{ name: "eventCount" }],
      dimensionFilter: allOf(hostFilter, eventsFilter(SIGNIN_EVENTS)),
    });

    // Batch 1 — core + previous window (6 reports, GA4 caps concurrency ~10).
    const [totals, events, channels, series, prevTotals, prevEvents] =
      await Promise.all([
        client.runReport(totalsReq(dateRanges)),
        client.runReport(eventsReq(dateRanges)),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }],
          dimensionFilter: hostFilter,
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 10,
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "date" }],
          metrics: [{ name: "sessions" }],
          dimensionFilter: hostFilter,
          orderBys: [{ dimension: { dimensionName: "date" } }],
        }),
        client.runReport(totalsReq(prevRanges)),
        client.runReport(eventsReq(prevRanges)),
      ]);

    // Batch 2 — audience split, sign-ins, demo breakdowns, weekly trend.
    const [audienceRpt, signInCur, signInPrev, demoByPageRpt, demoByChannelRpt, trendRpt] =
      await Promise.all([
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "newVsReturning" }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "engagedSessions" },
            { name: "engagementRate" },
            { name: "bounceRate" },
          ],
          dimensionFilter: hostFilter,
        }),
        client.runReport(signInReq(dateRanges)),
        client.runReport(signInReq(prevRanges)),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: allOf(hostFilter, eventsFilter(DEMO_EVENTS)),
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
          limit: 12,
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: allOf(hostFilter, eventsFilter(DEMO_EVENTS)),
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
          limit: 8,
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "date" }, { name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: allOf(hostFilter, eventsFilter([...DEMO_EVENTS, ...SIGNIN_EVENTS])),
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: 1000,
        }),
      ]);

    type Report = (typeof totals)[0];
    const eventCounts = (report: Report): Record<string, number> => {
      const map: Record<string, number> = {};
      for (const row of report.rows ?? []) {
        map[row.dimensionValues?.[0]?.value ?? ""] = num(row.metricValues?.[0]?.value);
      }
      return map;
    };
    const statsFrom = (mv: { value?: string | null }[] | undefined): AudienceStats => ({
      sessions: num(mv?.[0]?.value),
      users: num(mv?.[1]?.value),
      engagedSessions: num(mv?.[2]?.value),
      engagementRate: num(mv?.[3]?.value),
      bounceRate: num(mv?.[4]?.value),
    });

    const t = totals[0].rows?.[0]?.metricValues ?? [];
    const eventMap = eventCounts(events[0]);
    const pt = prevTotals[0].rows?.[0]?.metricValues ?? [];
    const prevEventMap = eventCounts(prevEvents[0]);

    const audienceRows: Record<string, { value?: string | null }[]> = {};
    for (const row of audienceRpt[0].rows ?? []) {
      audienceRows[row.dimensionValues?.[0]?.value ?? ""] = row.metricValues ?? [];
    }

    // Weekly demo + sign-in trend (sign-in names aliased into one bucket).
    const weeks: Record<string, { demo: number; signin: number }> = {};
    for (const row of trendRpt[0].rows ?? []) {
      const wk = weekStart(row.dimensionValues?.[0]?.value ?? "");
      const ev = row.dimensionValues?.[1]?.value ?? "";
      const bucket = (weeks[wk] ??= { demo: 0, signin: 0 });
      if (SIGNIN_EVENTS.includes(ev)) bucket.signin += num(row.metricValues?.[0]?.value);
      else bucket.demo += num(row.metricValues?.[0]?.value);
    }
    const trend = Object.keys(weeks)
      .sort()
      .map((week) => ({ week, demo: weeks[week].demo, signin: weeks[week].signin }));

    return {
      status: "ok",
      sessions: num(t[0]?.value),
      users: num(t[1]?.value),
      newUsers: num(t[2]?.value),
      demoClicks: eventMap["demo_click"] ?? 0,
      leads: eventMap["generate_lead"] ?? 0,
      newsletterSignups: eventMap["newsletter_signup"] ?? 0,
      videoPlays: eventMap["video_start"] ?? 0,
      byChannel: (channels[0].rows ?? []).map((r) => ({
        channel: r.dimensionValues?.[0]?.value || "(other)",
        sessions: num(r.metricValues?.[0]?.value),
      })),
      timeseries: (series[0].rows ?? []).map((r) => {
        const d = r.dimensionValues?.[0]?.value || "";
        const date =
          d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
        return { date, sessions: num(r.metricValues?.[0]?.value) };
      }),
      host: HOST,
      audience: {
        // `t` is the 6-metric totals layout (sessions, users, newUsers, engaged,
        // engagementRate, bounceRate) — note the index skip past newUsers.
        all: {
          sessions: num(t[0]?.value),
          users: num(t[1]?.value),
          engagedSessions: num(t[3]?.value),
          engagementRate: num(t[4]?.value),
          bounceRate: num(t[5]?.value),
        },
        // audienceRows use the 5-metric layout `statsFrom` expects.
        new: statsFrom(audienceRows["new"]),
        returning: statsFrom(audienceRows["returning"]),
      },
      signIns: num(signInCur[0].rows?.[0]?.metricValues?.[0]?.value),
      demoByPage: (demoByPageRpt[0].rows ?? []).map((r) => ({
        page: r.dimensionValues?.[0]?.value || "(unknown)",
        count: num(r.metricValues?.[0]?.value),
      })),
      demoByChannel: (demoByChannelRpt[0].rows ?? []).map((r) => ({
        channel: r.dimensionValues?.[0]?.value || "(other)",
        count: num(r.metricValues?.[0]?.value),
      })),
      trend,
      previous: {
        sessions: num(pt[0]?.value),
        users: num(pt[1]?.value),
        newUsers: num(pt[2]?.value),
        demoClicks: prevEventMap["demo_click"] ?? 0,
        leads: prevEventMap["generate_lead"] ?? 0,
        newsletterSignups: prevEventMap["newsletter_signup"] ?? 0,
        videoPlays: prevEventMap["video_start"] ?? 0,
        signIns: num(signInPrev[0].rows?.[0]?.metricValues?.[0]?.value),
      },
    };
  } catch (e) {
    return { ...EMPTY, status: "error", error: (e as Error).message };
  }
}
