import type { ReactNode } from "react";
import type { SourceStatus } from "@/lib/types";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-hairline bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

// Period-over-period change vs the previous window. Green up / red down; when
// there's no prior baseline (prev = 0) a non-zero current reads as genuinely
// "new" rather than a divide-by-zero percentage.
export function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (prev <= 0) {
    if (cur <= 0) return null;
    return (
      <span className="text-xs font-medium text-success" title="vs previous period">
        ↑ new
      </span>
    );
  }
  const change = ((cur - prev) / prev) * 100;
  const flat = Math.abs(change) < 0.05;
  const cls = flat ? "text-steel" : change > 0 ? "text-success" : "text-error";
  const arrow = flat ? "→" : change > 0 ? "↑" : "↓";
  return (
    <span className={`text-xs font-medium ${cls}`} title="vs previous period">
      {arrow} {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export function Kpi({
  label,
  value,
  hint,
  unavailable = false,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  // When the source errored/isn't connected, show "—" rather than a 0 that
  // reads as a real result.
  unavailable?: boolean;
  // Current + previous-period raw values; renders a period-over-period badge.
  delta?: { cur: number; prev: number };
}) {
  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wide text-steel">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl font-semibold tracking-tight ${
          unavailable ? "text-steel/50" : "text-ink"
        }`}
      >
        {unavailable ? "—" : value}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-sm text-steel">
        <span className="truncate">
          {unavailable ? "Source unavailable" : (hint ?? " ")}
        </span>
        {!unavailable && delta ? (
          <DeltaBadge cur={delta.cur} prev={delta.prev} />
        ) : null}
      </div>
    </Card>
  );
}

export function StatusPill({ status }: { status: SourceStatus }) {
  const map: Record<SourceStatus, { label: string; cls: string }> = {
    ok: { label: "Live", cls: "bg-success/10 text-success" },
    not_configured: { label: "Not connected", cls: "bg-hairline text-steel" },
    error: { label: "Error", cls: "bg-error/10 text-error" },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function SectionHeader({
  title,
  status,
  note,
}: {
  title: string;
  status?: SourceStatus;
  note?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="flex items-center gap-3">
        {note ? <span className="text-sm text-steel">{note}</span> : null}
        {status ? <StatusPill status={status} /> : null}
      </div>
    </div>
  );
}
