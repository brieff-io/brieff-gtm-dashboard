import { BigQuery } from "@google-cloud/bigquery";
import type { DateRange, BigQueryInsights } from "./types";

// GA4 → BigQuery event-level export. Reuses the same service account as the GA4
// Data API (granted bigquery.dataViewer + bigquery.jobUser). Configure via env:
//   GA_BQ_PROJECT_ID   project holding the export (e.g. brieff-gtm-dashboard)
//   GA_BQ_DATASET      dataset name (e.g. analytics_313410833)
//   GA_BQ_LOCATION     dataset location (default australia-southeast1)
// Fails soft: not_configured when env is unset, pending while the export has
// been linked but no daily tables exist yet (~24h), error on a real failure.

const PROJECT_ID = process.env.GA_BQ_PROJECT_ID;
const DATASET = process.env.GA_BQ_DATASET;
const LOCATION = process.env.GA_BQ_LOCATION || "australia-southeast1";
const CLIENT_EMAIL = process.env.GA_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n");

const EMPTY: BigQueryInsights = {
  status: "not_configured",
  recentEvents: 0,
  recentUsers: 0,
};

export async function getBigQueryInsights(
  range: DateRange,
): Promise<BigQueryInsights> {
  if (!PROJECT_ID || !DATASET || !CLIENT_EMAIL || !PRIVATE_KEY) return EMPTY;

  try {
    const bq = new BigQuery({
      projectId: PROJECT_ID,
      credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
    });

    // GA4 export tables are events_YYYYMMDD; query the daily-table wildcard for
    // the range (the suffix filter naturally excludes events_intraday_*).
    const start = range.start.replace(/-/g, "");
    const end = range.end.replace(/-/g, "");
    try {
      const [rows] = await bq.query({
        location: LOCATION,
        query: `SELECT
                  COUNT(*) AS events,
                  COUNT(DISTINCT user_pseudo_id) AS users
                FROM \`${PROJECT_ID}.${DATASET}.events_*\`
                WHERE _TABLE_SUFFIX BETWEEN @start AND @end`,
        params: { start, end },
      });
      const r = (rows[0] ?? {}) as { events?: number; users?: number };
      return {
        status: "ok",
        recentEvents: Number(r.events ?? 0),
        recentUsers: Number(r.users ?? 0),
      };
    } catch (e) {
      // Dataset/tables not created yet (export just linked) → awaiting first export.
      if (/not found/i.test((e as Error).message)) {
        return { ...EMPTY, status: "pending" };
      }
      throw e;
    }
  } catch (e) {
    return { ...EMPTY, status: "error", error: (e as Error).message };
  }
}
