import type { FunnelStage } from "@/lib/types";
import { fmtNum, pct } from "@/lib/format";
import { Card } from "./ui";

// Cross-source GTM funnel. Bar width is relative to the top stage; the % shows
// conversion from the previous stage.
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.value || 0;
  return (
    <Card>
      <div className="space-y-4">
        {stages.map((s, i) => {
          const width = top > 0 ? Math.max((s.value / top) * 100, 1.5) : 1.5;
          const prev = i > 0 ? stages[i - 1].value : null;
          return (
            <div key={s.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-ink">{s.label}</span>
                <span className="text-steel">
                  {fmtNum(s.value)}
                  {prev !== null ? (
                    <span className="ml-2 text-xs text-steel">
                      {pct(s.value, prev)} of prev
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1.5 h-7 w-full rounded bg-canvas">
                <div
                  className="h-7 rounded bg-azure"
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-steel">
                {s.source}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
