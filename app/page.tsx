import { getDashboardData } from "@/lib/dashboard";
import { fmtCurrency, fmtNum, pct } from "@/lib/format";
import { Card, Kpi, SectionHeader } from "@/components/ui";
import { Funnel } from "@/components/funnel";
import { ChannelChart, SessionsChart } from "@/components/charts";

// Render on each request so the numbers are always fresh (low-traffic internal
// tool). The data fetchers cap their own work to stay within API limits.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { range, ga4, hubspot, stripe, funnel } = await getDashboardData(30);

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
        <p className="text-xs text-steel">
          Sources: GA4 · HubSpot · Stripe
        </p>
      </div>

      {/* Funnel */}
      <section className="mb-8">
        <SectionHeader title="GTM funnel" />
        <Funnel stages={funnel} />
      </section>

      {/* KPI row */}
      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Sessions" value={fmtNum(ga4.sessions)} hint={`${fmtNum(ga4.users)} users`} />
        <Kpi
          label="Demo clicks"
          value={fmtNum(ga4.demoClicks)}
          hint={`${pct(ga4.demoClicks, ga4.sessions)} of sessions`}
        />
        <Kpi label="New contacts" value={fmtNum(hubspot.newContacts)} hint="HubSpot, in range" />
        <Kpi
          label="Pipeline value"
          value={fmtCurrency(hubspot.pipelineValue, stripe.currency)}
          hint={`${fmtNum(hubspot.openDeals)} open deals`}
        />
        <Kpi label="Deals created" value={fmtNum(hubspot.dealsCreated)} hint="In range" />
        <Kpi
          label="Closed won"
          value={fmtNum(hubspot.wonDeals)}
          hint={fmtCurrency(hubspot.wonValue, stripe.currency)}
        />
        <Kpi label="MRR" value={fmtCurrency(stripe.mrr, stripe.currency)} hint={`${fmtNum(stripe.activeSubscriptions)} active subs`} />
        <Kpi label="New customers" value={fmtNum(stripe.newCustomers)} hint="Stripe, in range" />
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
          <Kpi label="Leads (form)" value={fmtNum(ga4.leads)} hint="generate_lead" />
          <Kpi label="Newsletter" value={fmtNum(ga4.newsletterSignups)} hint="signups" />
          <Kpi label="Video plays" value={fmtNum(ga4.videoPlays)} hint="video_start" />
          <Kpi label="New users" value={fmtNum(ga4.newUsers)} hint="first-time" />
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
          <Kpi label="MRR" value={fmtCurrency(stripe.mrr, stripe.currency)} />
          <Kpi label="ARR (est.)" value={fmtCurrency(stripe.mrr * 12, stripe.currency)} />
          <Kpi label="Active subscriptions" value={fmtNum(stripe.activeSubscriptions)} />
          <Kpi label="New customers" value={fmtNum(stripe.newCustomers)} hint="in range" />
        </div>
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
