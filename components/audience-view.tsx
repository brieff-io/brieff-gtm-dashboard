"use client";

import { useState } from "react";
import type { AudienceStats } from "@/lib/types";
import { fmtNum } from "@/lib/format";

// Lets the viewer switch the headline traffic stats between raw totals and a
// prospects-only read (existing-customer/sign-in traffic heavily distorts the
// marketing picture — see the sign-in volume below).
const TABS = [
  { key: "all", label: "All traffic" },
  { key: "new", label: "Prospects (new)" },
  { key: "returning", label: "Existing (returning)" },
] as const;

type Key = (typeof TABS)[number]["key"];

const asPct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function AudienceView({
  all,
  prospects,
  existing,
}: {
  all: AudienceStats;
  prospects: AudienceStats;
  existing: AudienceStats;
}) {
  const [tab, setTab] = useState<Key>("all");
  const a = tab === "all" ? all : tab === "new" ? prospects : existing;

  const stats: { label: string; value: string }[] = [
    { label: "Sessions", value: fmtNum(a.sessions) },
    { label: "Users", value: fmtNum(a.users) },
    { label: "Engaged sessions", value: fmtNum(a.engagedSessions) },
    { label: "Engagement rate", value: asPct(a.engagementRate) },
    { label: "Bounce rate", value: asPct(a.bounceRate) },
  ];

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-hairline bg-white p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-brand text-white"
                : "text-slate hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-hairline bg-white p-5 shadow-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-steel">
              {s.label}
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-ink">
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
