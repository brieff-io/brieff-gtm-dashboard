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
};

export async function getHubSpotMetrics(
  range: DateRange,
): Promise<HubSpotMetrics> {
  if (!TOKEN) return EMPTY;

  try {
    // Retry on 429/5xx with the client's built-in backoff so a transient rate
    // limit doesn't blank the whole pipeline section.
    const client = new Client({ accessToken: TOKEN, numberOfApiCallRetries: 3 });
    const startMs = String(new Date(`${range.start}T00:00:00Z`).getTime());

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
      const r = await api.doSearch(req);
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
      const r = await client.crm.deals.searchApi.doSearch(req);
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
      const r = await client.crm.deals.searchApi.doSearch(req);
      for (const d of r.results ?? []) {
        wonDeals += 1;
        wonValue += Number(d.properties?.amount) || 0;
      }
      after = r.paging?.next?.after;
      if (!after) break;
    }

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
    };
  } catch (e) {
    return { ...EMPTY, status: "error", error: (e as Error).message };
  }
}
