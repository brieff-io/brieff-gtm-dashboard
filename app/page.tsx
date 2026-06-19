import { getDashboardData } from "@/lib/dashboard";
import { fmtCurrency, fmtNum, fmtRelativeTime, pct } from "@/lib/format";
import { Card, Kpi, SectionHeader } from "@/components/ui";
import { Funnel } from "@/components/funnel";
import { ChannelChart, SessionsChart } from "@/components/charts";

// The page renders per request, but external data (GA4/HubSpot/Stripe) is cached
// in getDashboardData and refreshed at most every 10 minutes, so refreshing the
// page repeatedly will not hammer the source APIs.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { range, ga4, hubspot, stripe, funnel, fetchedAt } =
    await getDashboardData(30);

  // Drive the per-KPI "—" state off each source's status so an errored fetch
  // never shows as a real 0.
  const ga4Ok = ga4.status === "ok";
  const hubspotOk = hubspot.status === "ok";
  const stripeOk = stripe.status === "ok";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            GTM Dashboard
          </h1>
          <p className="mt-1 text-sm text-steel">
            {range.start} to {range.end} (last {range.days} days)
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-steel">Sources: GA4 · HubSpot · Stripe</p>
          <p className="mt-1 text-xs text-steel">
            Updated {fmtRelativeTime(fetchedAt)}
          </p>
        </div>
      </div>

      {/* Funnel */}
      <section className="mb-8">
        <SectionHeader title="GTM funnel" />
        <Funnel stages={funnel} />
      </section>

      {/* KPI row */}
      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Sessions" value={fmtNum(ga4.sessions)} hint={`${fmtNum(ga4.users)} users`} unavailable={!ga4Ok} />
        <Kpi
          label="Demo clicks"
          value={fmtNum(ga4.demoClicks)}
          hint={`${pct(ga4.demoClicks, ga4.sessions)} of sessions`}
          unavailable={!ga4Ok}
        />
        <Kpi label="New contacts" value={fmtNum(hubspot.newContacts)} hint="HubSpot, in range" unavailable={!hubspotOk} />
        <Kpi
          label="Pipeline value"
          value={fmtCurrency(hubspot.pipelineValue, stripe.currency)}
          hint={`${fmtNum(hubspot.openDeals)} open deals`}
          unavailable={!hubspotOk}
        />
        <Kpi label="Deals created" value={fmtNum(hubspot.dealsCreated)} hint="In range" unavailable={!hubspotOk} />
        <Kpi
          label="Closed won"
          value={fmtNum(hubspot.wonDeals)}
          hint={fmtCurrency(hubspot.wonValue, stripe.currency)}
          unavailable={!hubspotOk}
        />
        <Kpi label="MRR" value={fmtCurrency(stripe.mrr, stripe.currency)} hint={`${fmtNum(stripe.activeSubscriptions)} active subscribers`} unavailable={!stripeOk} />
        <Kpi label="New customers" value={fmtNum(stripe.newCustomers)} hint="Stripe, in range" unavailable={!stripeOk} />
      </section>

      {/* GA4 */}
      <section className="mb-8">
        <SectionHeader
          title="Web acquisition (GA4)"
          status={ga4.status}
          note={ga4.status === "error" ? ga4.error : undefined}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-2 text-sm font-medium text-ink">Sessions over time</div>
            <SessionsChart data={ga4.timeseries} />
          </Card>
          <Card>
            <div className="mb-2 text-sm font-medium text-ink">Sessions by channel</div>
            <ChannelChart data={ga4.byChannel} />
          </Card>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Leads (form)" value={fmtNum(ga4.leads)} hint="generate_lead" unavailable={!ga4Ok} />
          <Kpi label="Newsletter" value={fmtNum(ga4.newsletterSignups)} hint="signups" unavailable={!ga4Ok} />
          <Kpi label="Video plays" value={fmtNum(ga4.videoPlays)} hint="video_start" unavailable={!ga4Ok} />
          <Kpi label="New users" value={fmtNum(ga4.newUsers)} hint="first-time" unavailable={!ga4Ok} />
        </div>
      </section>

      {/* HubSpot */}
      <section className="mb-8">
        <SectionHeader title="Pipeline (HubSpot)" status={hubspot.status} note={hubspot.status === "error" ? hubspot.error : undefined} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 text-sm font-medium text-ink">Contacts by lifecycle stage</div>
            <Table
              rows={hubspot.byLifecycle.map((r) => [r.stage, fmtNum(r.count)])}
              empty="No lifecycle data."
            />
          </Card>
          <Card>
            <div className="mb-3 text-sm font-medium text-ink">Open deals by stage</div>
            <Table
              rows={hubspot.byDealStage.map((r) => [
                r.stage,
                `${fmtNum(r.count)} · ${fmtCurrency(r.amount, stripe.currency)}`,
              ])}
              empty="No open deals."
            />
          </Card>
        </div>
      </section>

      {/* Stripe */}
      <section className="mb-8">
        <SectionHeader title="Revenue (Stripe)" status={stripe.status} note={stripe.status === "error" ? stripe.error : undefined} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="MRR" value={fmtCurrency(stripe.mrr, stripe.currency)} hint={stripe.currency.toUpperCase()} unavailable={!stripeOk} />
          <Kpi label="ARR (est.)" value={fmtCurrency(stripe.mrr * 12, stripe.currency)} hint={stripe.currency.toUpperCase()} unavailable={!stripeOk} />
          <Kpi label="Active subscribers" value={fmtNum(stripe.activeSubscriptions)} hint="paying" unavailable={!stripeOk} />
          <Kpi label="New customers" value={fmtNum(stripe.newCustomers)} hint="in range" unavailable={!stripeOk} />
        </div>
        {stripe.mrrByCurrency.length > 1 && (
          <p className="mt-3 text-xs text-steel">
            Blended into {stripe.currency.toUpperCase()} from:{" "}
            {stripe.mrrByCurrency.map((m) => fmtCurrency(m.mrr, m.currency)).join(" · ")}{" "}
            (discounts applied, live FX).
          </p>
        )}
      </section>

      <p className="text-xs text-steel">
        Not-connected sources show zeros until their credentials are set in
        environment variables. Access is gated by Vercel Deployment Protection.
      </p>
    </main>
  );
}

function Table({ rows, empty }: { rows: [string, string][]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-steel">{empty}</p>;
  }
  return (
    <div className="divide-y divide-hairline">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between py-2 text-sm">
          <span className="capitalize text-slate">{k.replace(/_/g, " ")}</span>
          <span className="font-medium text-ink">{v}</span>
        </div>
      ))}
    </div>
  );
}
