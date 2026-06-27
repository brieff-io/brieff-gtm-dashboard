# GA4 → BigQuery export — setup & plan

The GA4 Data API (what the dashboard uses today) only returns **aggregates** — it
can't answer "what page sequence led to a demo?" or give event-level history. The
**GA4 → BigQuery export** streams raw, event-level data, which unlocks true
journey/path analysis, sequential funnels, cohorts, and a place to also snapshot
revenue for real MRR/churn trends.

This is config only you can do (the dashboard's service account is read-only).
None of it is reversible-after-data-loss, but it's all low-risk. Do 1→5 in order.

---

## What you change in Google Cloud + GA4

> **Status — DONE (2026-06-27):** GA4→BigQuery link **created** into
> `brieff-gtm-dashboard` (Daily, `australia-southeast1`); the GA4 export service
> account `firebase-measurement@system.gserviceaccount.com` was auto-granted
> `bigquery.user`; and `gtm-dashboard-reader` has `bigquery.dataViewer` +
> `bigquery.jobUser` ✓. A canary `SELECT 1` as the service account succeeded, so
> auth + query permission work. The `analytics_313410833` dataset / first daily
> `events_*` tables land within ~24h of linking — the dashboard's BigQuery
> section shows a "pending" state until then, then activates automatically.
> Steps A/B below are retained for reference.
>
> **To activate in production:** add `GA_BQ_PROJECT_ID=brieff-gtm-dashboard`,
> `GA_BQ_DATASET=analytics_313410833`, `GA_BQ_LOCATION=australia-southeast1` to
> Vercel env (already set in local `.env.local`).

### A. Link GA4 → BigQuery  *(GA4 Admin UI — the only step I can't do for you)*
- GA4 Admin → **Product links → BigQuery links → Link**.
- Project: **`brieff-gtm-dashboard`**.
- **Data location**: `australia-southeast1` (Sydney) — ⚠️ permanent for the dataset.
- **Frequency**: **Daily** (free batch). Leave *Streaming* off.
- Export the **web data stream**; advertising identifiers not needed.
- Creates dataset **`analytics_313410833`** with daily `events_YYYYMMDD` tables.

### B. Grant the service account BigQuery access  *(one IAM change — yours to run)*
```
gcloud projects add-iam-policy-binding brieff-gtm-dashboard \
  --member="serviceAccount:gtm-dashboard-reader@brieff-gtm-dashboard.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding brieff-gtm-dashboard \
  --member="serviceAccount:gtm-dashboard-reader@brieff-gtm-dashboard.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"
```
(I don't run IAM / access-control changes myself — but that's the exact command,
or do it in Console → IAM & Admin → IAM.)

### C. Then just tell me it's linked
I'll set `GA_BQ_PROJECT_ID=brieff-gtm-dashboard` and
`GA_BQ_DATASET=analytics_313410833` and build against it — using the **same**
`GA_CLIENT_EMAIL` / `GA_PRIVATE_KEY` credentials (no new keys needed).

---

## ⚠️ The one catch: it's not retroactive
The export only captures data **from the link date forward**. So enable it now
even if we build on it later — day 1 has ~no history, and journey/trend depth
accrues over the following weeks. (The Data API still backfills the existing
aggregate views in the meantime.)

## Cost
Your scale is tiny (~800 sessions / 30 days → a few MB/month). BigQuery free tier
is **10 GB storage + 1 TB queries/month** — you will almost certainly pay $0.
Billing must still be *attached* (step 1); set a $1–5 budget alert if you want a
backstop.

---

## What I'll build on top (once it's live + IAM is granted)

A `lib/bigquery.ts` fetcher (same fail-soft pattern as the others) plus new views:

1. **True demo funnel** — sequential, per session/user: visit → key-page view →
   `demo_click`, with real stage conversion (not the directional aggregate funnel
   we have now). Extends into HubSpot (demo booked) + Stripe (trial → paid).
2. **Top paths to demo** — the actual page sequences preceding a demo click
   (e.g. `/ → /features/structure → demo`). This is the literal "what does the
   visitor journey look like" answer, impossible via the Data API.
3. **First-touch attribution** — which landing page / channel a demo-clicker (and
   eventual customer) first arrived through.
4. **Honest long-range trends** — demo / sign-in / sessions over any window,
   straight from raw events (no Data API sampling/freshness quirks).
5. **(Optional) unified store for revenue snapshots** — a daily Vercel cron
   writing a Stripe MRR/subscriber snapshot into a BQ table. That closes
   roadmap #4 (real MRR / churn / NRR trends) using the same warehouse.

I can scaffold the env vars + `lib/bigquery.ts` skeleton now if you want a head
start, but I'd hold real query work until the export has run (so I can verify
against actual rows rather than ship untested SQL).
