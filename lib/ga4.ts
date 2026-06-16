import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { DateRange, Ga4Metrics } from "./types";

// GA4 Data API. Needs a Google Cloud service account with the Analytics Data
// API enabled, granted Viewer on the GA4 property. Configure via env:
//   GA_PROPERTY_ID   numeric property id (e.g. 313410833)
//   GA_CLIENT_EMAIL  service account email
//   GA_PRIVATE_KEY   service account private key (with \n escapes is fine)

const PROPERTY_ID = process.env.GA_PROPERTY_ID;
const CLIENT_EMAIL = process.env.GA_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n");

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
};

function num(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getGa4Metrics(range: DateRange): Promise<Ga4Metrics> {
  if (!PROPERTY_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return EMPTY;

  try {
    const client = new BetaAnalyticsDataClient({
      credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
    });
    const property = `properties/${PROPERTY_ID}`;
    const dateRanges = [{ startDate: range.start, endDate: range.end }];

    const [totals, events, channels, series] = await Promise.all([
      client.runReport({
        property,
        dateRanges,
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "newUsers" },
        ],
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                "demo_click",
                "generate_lead",
                "newsletter_signup",
                "video_start",
              ],
            },
          },
        },
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
    ]);

    const t = totals[0].rows?.[0]?.metricValues ?? [];
    const eventMap: Record<string, number> = {};
    for (const row of events[0].rows ?? []) {
      const name = row.dimensionValues?.[0]?.value ?? "";
      eventMap[name] = num(row.metricValues?.[0]?.value);
    }

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
    };
  } catch (e) {
    return { ...EMPTY, status: "error", error: (e as Error).message };
  }
}
