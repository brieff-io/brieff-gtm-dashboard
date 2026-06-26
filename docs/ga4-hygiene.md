# GA4 hygiene — make the marketing data trustworthy

Actions to take in the GA4 property (`313410833`, "Brieff Website") so the
dashboard's web-acquisition numbers reflect *marketing performance*, not
existing-customer sign-in traffic. Based on a 30-day audit (June 2026): 800
sessions, but 227 sign-in clicks (90% returning users), `keyEvents = 0` (no
conversions configured), a mid-month sign-in event rename, and dev/bot/typo
noise. GA4 UI labels may shift slightly over time.

Do these in order. 1–4 are GA4 settings; 5–6 are website changes.

---

## 1. Mark key events (conversions) — nothing is marked today

GA4 currently counts **zero** conversions, so its funnels and the dashboard's
"keyEvents" are empty.

**Path:** Admin → Data display → **Key events** → *New key event* (or Reports →
Engage → Events → toggle **Mark as key event** on the row).

Mark these existing events as key events:
- `demo_click`
- `generate_lead`
- `click_button_bookdemo_footer` (the "Book a demo" CTA)

> Not retroactive — key-event status counts from when you set it. That's fine;
> we want it going forward.

There is **no signup/trial event yet** (see §6) — add and mark it once it exists.

---

## 2. Unify the sign-in event — it was renamed mid-stream

Two event names describe the **same** action across a tracking change (~15 Jun):
- `click_button_signin_navbar` (old — dropped to 0 after the change)
- `login_click` (new — started mid-June)

A naive "sign-ins over time" chart will show a false cliff. Fix the source, then
let the dashboard bridge history:

- **Preferred (website/GTM):** standardize on a single event name going forward —
  use `login_click` everywhere the navbar/login button fires.
- **GA4 fallback (no code):** Admin → Data display → **Events** → *Create event*
  or *Modify event* → match `event_name = click_button_signin_navbar`, set
  `event_name = login_click`. Merges them from now on (not retroactive).
- **Dashboard:** it will **alias** both names into one "sign-ins" series so the
  historical line stays continuous regardless.

---

## 3. Exclude internal / dev / bot traffic

Audit noise: `localhost` (7) and `brieff-website.vercel.app` (5) dev sessions, and
`smart tv` (13 — almost certainly bots).

- **Dev hostnames:** GA4's built-in filters key off IP (internal) or the
  `debug_mode` flag (developer), not hostname — so the reliable fix is to filter
  to the production host in the dashboard query (it will restrict to
  `hostName = www.brieff.io`). Optionally also set Admin → Data Settings → **Data
  Filters** → *Developer traffic* → Active.
- **Internal traffic by IP:** Admin → Data Streams → web stream → *Configure tag
  settings* → Show all → **Define internal traffic** (add office/home IPs), then
  Admin → Data Settings → Data Filters → *Internal Traffic* → set **Active**
  (it defaults to "Testing", which does nothing).
- **Bots:** GA4 auto-excludes known bots; the smart-tv sessions will be dropped
  by the production-host filter above. Keep an eye on the Tech → Device report.

---

## 4. Referral exclusions — typo domains are creating fake sessions

Self/typo referrals are fragmenting attribution (counted as "Referral" instead of
keeping the original source): `breif.io` (21), `breiff.io` (15), `breiff.com` (8),
plus `webflow.com`/`vercel.com` infra.

**Path:** Admin → Data Streams → web stream → *Configure tag settings* → Show all
→ **List unwanted referrals** → add (match type "contains"):
`brieff.io`, `breif.io`, `breiff.io`, `breiff.com`, and the app domain if the
platform lives on a subdomain (e.g. `app.brieff.io`).

---

## 5. Consolidate duplicate URLs (website + SEO)

**Done** — these legacy paths are now 308-redirected to their current routes in
the `brieff-website` repo (`next.config.ts`), recovering ~165 views/mo that were
hitting 404s and removing the duplicate-URL noise: `/about-us`→`/about`,
`/contact-us`→`/contact`, `/privacy-policy`→`/privacy`,
`/terms-and-conditions`→`/terms`, `/customer-stories[/:slug]`→`/customers[/:slug]`,
`/mobile-app` & `/client-app-2`→`/features/mobile`. No GA4 action needed.

---

## 6. Add a signup / trial event (instrumentation) — app-side, not the website

There is no event marking account creation, so GA4 can't see the conversion that
produces Stripe customers. Note the funnel is **demo → 14-day trial → paid**, and
signup/trial happens in the **app (app.brieff.io), not the marketing site** — so
this can't be a marketing-site event. Either instrument a `sign_up`/`trial_start`
event in the app (and mark it a key event), or — simpler — **derive trial→paid
from Stripe** (trialing → active subscriptions). The marketing site's job ends at
`demo_click`; HubSpot + Stripe carry it from there.

---

## 7. (Optional) Audience for existing-customer / sign-in traffic

Admin → Audiences → *New audience* → condition: `login_click` (or
`click_button_signin_navbar`) event in session, or `newVsReturning = returning`.
Use it to **exclude** sign-in traffic from acquisition views, or to track
existing-customer pull on its own.

---

## Verify it worked

- **Realtime / DebugView** (Admin → DebugView) — trigger sign-in, demo, lead and
  confirm the (unified) event names fire.
- **Reports → Engage → Key events** — should show non-zero conversions within
  ~24h of §1.
- **Acquisition → Traffic acquisition** — typo-domain referrals should stop
  appearing as new sessions after §4.
