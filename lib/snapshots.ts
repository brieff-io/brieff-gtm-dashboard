import { BigQuery } from "@google-cloud/bigquery";
import type { SnapshotPoint } from "./types";

// Daily revenue snapshots in BigQuery, so point-in-time metrics (MRR, active
// subscribers, trials) gain a real trend over time. Written once a day by the
// cron route (needs bigquery.dataEditor on the project to create + insert), read
// by the dashboard (bigquery.dataViewer + jobUser). Reuses the GA4 service
// account credentials. Fails soft everywhere: if it isn't configured or the
// table doesn't exist yet, the dashboard simply shows no trend.

const PROJECT_ID = process.env.GA_BQ_PROJECT_ID;
const DATASET = process.env.GA_BQ_SNAPSHOT_DATASET || "dashboard";
const TABLE = "mrr_snapshots";
const LOCATION = process.env.GA_BQ_LOCATION || "australia-southeast1";
const CLIENT_EMAIL = process.env.GA_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n");

const FQN = () => `\`${PROJECT_ID}.${DATASET}.${TABLE}\``;

function client(): BigQuery | null {
  if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return null;
  return new BigQuery({
    projectId: PROJECT_ID,
    credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
  });
}

// Write today's snapshot. Creates the dataset/table on first run (idempotent).
export async function writeSnapshot(p: {
  mrr: number;
  activeSubscribers: number;
  trials: number;
  currency: string;
}): Promise<void> {
  const bq = client();
  if (!bq) throw new Error("BigQuery not configured");

  // Idempotent create (dataset + table) via DDL, then a DML insert (free, and
  // immediately queryable — no streaming buffer).
  await bq.query({
    location: LOCATION,
    query: `CREATE SCHEMA IF NOT EXISTS \`${PROJECT_ID}.${DATASET}\``,
  });
  await bq.query({
    location: LOCATION,
    query: `CREATE TABLE IF NOT EXISTS ${FQN()} (
      snapshot_date DATE, mrr FLOAT64, arr FLOAT64,
      active_subscribers INT64, trials INT64, currency STRING, captured_at TIMESTAMP
    )`,
  });
  await bq.query({
    location: LOCATION,
    query: `INSERT INTO ${FQN()}
      (snapshot_date, mrr, arr, active_subscribers, trials, currency, captured_at)
      VALUES (CURRENT_DATE(), @mrr, @arr, @subs, @trials, @currency, CURRENT_TIMESTAMP())`,
    params: {
      mrr: p.mrr,
      arr: Math.round(p.mrr * 12 * 100) / 100,
      subs: p.activeSubscribers,
      trials: p.trials,
      currency: p.currency,
    },
  });
}

// Read the last `days` of snapshots (one row per day, latest capture wins).
export async function getMrrTrend(days = 90): Promise<SnapshotPoint[]> {
  const bq = client();
  if (!bq) return [];
  try {
    const [rows] = await bq.query({
      location: LOCATION,
      query: `SELECT snapshot_date, mrr, active_subscribers, trials
              FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
              WHERE snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
              QUALIFY ROW_NUMBER() OVER (
                PARTITION BY snapshot_date ORDER BY captured_at DESC
              ) = 1
              ORDER BY snapshot_date`,
      params: { days },
    });
    return (rows as Record<string, unknown>[]).map((r) => ({
      date: typeof r.snapshot_date === "object" && r.snapshot_date
        ? (r.snapshot_date as { value: string }).value
        : String(r.snapshot_date),
      mrr: Number(r.mrr ?? 0),
      activeSubscribers: Number(r.active_subscribers ?? 0),
      trials: Number(r.trials ?? 0),
    }));
  } catch {
    // Table not created yet (no snapshots recorded) → no trend.
    return [];
  }
}
