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

export function Kpi({
  label,
  value,
  hint,
  unavailable = false,
}: {
  label: string;
  value: string;
  hint?: string;
  // When the source errored/isn't connected, show "—" rather than a 0 that
  // reads as a real result.
  unavailable?: boolean;
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
      <div className="mt-1 text-sm text-steel">
        {unavailable ? "Source unavailable" : hint ?? " "}
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
