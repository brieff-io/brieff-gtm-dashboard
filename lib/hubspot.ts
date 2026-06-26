import { Client } from "@hubspot/api-client";
import type { DateRange, HubSpotMetrics } from "./types";

// HubSpot CRM. Authenticates with a Bearer token in env HUBSPOT_TOKEN — use a
// HubSpot Service Key (recommended) or a legacy Private App access token, with
// read access to Contacts and Deals. Uses the search API for counts + deal
// aggregation. Search request objects are typed loosely (`any`) because
// HubSpot's operator enum is verbose; responses stay fully typed.

const TOKEN = process.env.HUBSPOT_TOKEN;

const LIFECYCLE_STAGES = [
  "lead",
  "marketingqualifiedlead",
  "salesqualifiedlead",
  "opportunity",
  "customer",
];

// HubSpot's Search API returns at most 200 results per page and caps any single
// query at 10,000 total results, so 50 pages * 200 fetches everything it will
// return. This avoids silently undercounting pipeline at realistic deal volumes.
const PAGE_SIZE = 200;
const MAX_PAGES = 50;

// HubSpot's Search API enforces a strict "secondly" rate limit (~4 req/s). This
// fetcher fires many searches per load (new contacts, 5 lifecycle counts, deal
// pages, won-deal pages), and concurrent dashboard renders share the same limit,
// so unspaced bursts return 429 and blank the whole section. Route every search
// through one module-level gate that fully serializes calls and spaces them, so
// all in-flight requests across the process stay under the limit.
const MIN_SPACING_MS = 250;
let gate: Promise<unknown> = Promise.resolve();
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const result = gate.then(async () => {
    await new Promise((r) => setTimeout(r, MIN_SPACING_MS));
    return fn();
  });
  gate = result.catch(() => {}); // next call waits regardless of this one's outcome
  return result;
}

const EMPTY: HubSpotMetrics = {
  status: "not_configured",
  newContacts: 0,
  byLifecycle: [],
  dealsCreated: 0,
  openDeals: 0,
  pipelineValue: 0,
  wonDeals: 0,
  wonValue: 0,
  byDealStage: [],
  previous: { newContacts: 0, dealsCreated: 0, wonDeals: 0 },
};

export async function getHubSpotMetrics(
  range: DateRange,
  prev: DateRange,
): Promise<HubSpotMetrics> {
  if (!TOKEN) return EMPTY;

  try {
    // Retry on 429/5xx with the client's built-in backoff so a transient rate
    // limit doesn't blank the whole pipeline section.
    const client = new Client({ accessToken: TOKEN, numberOfApiCallRetries: 3 });
    const startMs = String(new Date(`${range.start}T00:00:00Z`).getTime());
    // Previous window is [prev.start, range.start): GTE prevStartMs AND LT startMs.
    const prevStartMs = String(new Date(`${prev.start}T00:00:00Z`).getTime());

    const countSearch = async (
      object: "contacts" | "deals",
      filters: { propertyName: string; operator: string; value: string }[],
    ): Promise<number> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req: any = { filterGroups: [{ filters }], limit: 1 };
      const api =
        object === "contacts"
          ? client.crm.contacts.searchApi
          : client.crm.deals.searchApi;
      const r = await throttle(() => api.doSearch(req));
      return r.total ?? 0;
    };

    // Contacts created in range, and current totals per lifecycle stage.
    const newContacts = await countSearch("contacts", [
      { propertyName: "createdate", operator: "GTE", value: startMs },
    ]);
    const byLifecycle = [];
    for (const stage of LIFECYCLE_STAGES) {
      byLifecycle.push({
        stage,
        count: await countSearch("contacts", [
          { propertyName: "lifecyclestage", operator: "EQ", value: stage },
        ]),
      });
    }

    const dealsCreated = await countSearch("deals", [
      { propertyName: "createdate", operator: "GTE", value: startMs },
    ]);

    // Open deals: paginate, sum amount, group by stage.
    let openDeals = 0;
    let pipelineValue = 0;
    const stageMap: Record<string, { count: number; amount: number }> = {};
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req: any = {
        filterGroups: [
          { filters: [{ propertyName: "hs_is_closed", operator: "EQ", value: "false" }] },
        ],
        properties: ["amount", "dealstage"],
        limit: PAGE_SIZE,
        after,
      };
      const r = await throttle(() => client.crm.deals.searchApi.doSearch(req));
      for (const d of r.results ?? []) {
        const amt = Number(d.properties?.amount) || 0;
        const stage = d.properties?.dealstage || "unknown";
        openDeals += 1;
        pipelineValue += amt;
        stageMap[stage] = stageMap[stage] || { count: 0, amount: 0 };
        stageMap[stage].count += 1;
        stageMap[stage].amount += amt;
      }
      after = r.paging?.next?.after;
      if (!after) break;
    }

    // Closed-won in range.
    let wonDeals = 0;
    let wonValue = 0;
    after = undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req: any = {
        filterGroups: [
          {
            filters: [
              { propertyName: "hs_is_closed_won", operator: "EQ", value: "true" },
              { propertyName: "closedate", operator: "GTE", value: startMs },
            ],
          },
        ],
        properties: ["amount"],
        limit: PAGE_SIZE,
        after,
      };
      const r = await throttle(() => client.crm.deals.searchApi.doSearch(req));
      for (const d of r.results ?? []) {
        wonDeals += 1;
        wonValue += Number(d.properties?.amount) || 0;
      }
      after = r.paging?.next?.after;
      if (!after) break;
    }

    // Previous-window counts for period-over-period deltas (cheap total-only
    // searches; amounts/pagination intentionally not repeated for the baseline).
    const prevNewContacts = await countSearch("contacts", [
      { propertyName: "createdate", operator: "GTE", value: prevStartMs },
      { propertyName: "createdate", operator: "LT", value: startMs },
    ]);
    const prevDealsCreated = await countSearch("deals", [
      { propertyName: "createdate", operator: "GTE", value: prevStartMs },
      { propertyName: "createdate", operator: "LT", value: startMs },
    ]);
    const prevWonDeals = await countSearch("deals", [
      { propertyName: "hs_is_closed_won", operator: "EQ", value: "true" },
      { propertyName: "closedate", operator: "GTE", value: prevStartMs },
      { propertyName: "closedate", operator: "LT", value: startMs },
    ]);

    return {
      status: "ok",
      newContacts,
      byLifecycle,
      dealsCreated,
      openDeals,
      pipelineValue,
      wonDeals,
      wonValue,
      byDealStage: Object.entries(stageMap).map(([stage, v]) => ({
        stage,
        count: v.count,
        amount: v.amount,
      })),
      previous: {
        newContacts: prevNewContacts,
        dealsCreated: prevDealsCreated,
        wonDeals: prevWonDeals,
      },
    };
  } catch (e) {
    return { ...EMPTY, status: "error", error: (e as Error).message };
  }
}
