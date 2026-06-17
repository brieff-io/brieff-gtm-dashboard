# brieff-gtm-dashboard

Internal go-to-market dashboard for Brieff. A Next.js (App Router) app that
pulls **GA4 + HubSpot + Stripe** server-side and shows one cross-source GTM
funnel (Visitors → Demo clicks → Contacts → Deals → Customers) plus web
acquisition, pipeline, and revenue.

> **Private tool.** It surfaces revenue and pipeline data. Access is controlled
> by **Vercel Deployment Protection** (Project Settings → Deployment
> Protection), not by app code. Enable it before sharing the URL.

## Stack
Next.js 15 · React 19 · TypeScript · Tailwind · Recharts. Server components call
each API directly (no public API keys; all secrets are server-side).

## Setup
1. `pnpm install`
2. Copy `.env.example` → `.env.local` and fill in credentials (see that file
   for how to create each):
   - **GA4:** service account (Analytics Data API) with Viewer on the property;
     `GA_PROPERTY_ID` is `313410833`.
   - **HubSpot:** a Service Key (recommended) or legacy Private App token, with
     read access to Contacts + Deals.
   - **Stripe:** restricted read-only secret key.
3. `pnpm dev` → http://localhost:3000

Any source without credentials renders as zeros / "Not connected", so you can
run the app before all keys are in place.

## Deploy (Vercel)
1. Import this repo as a **new Vercel project** (separate from the marketing
   site).
2. Add the same env vars under **Settings → Environment Variables**.
3. Turn on **Deployment Protection** (password or Vercel SSO).
4. Deploy.

## Data notes
- Reporting window: last 30 days (see `lib/range.ts`).
- The page is `force-dynamic` (fresh on each request); fetchers cap their own
  work to stay within API limits.
- GA4 (sessions) and HubSpot (contacts) won't reconcile exactly — different
  units and attribution. That's expected.
