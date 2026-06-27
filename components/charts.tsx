"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function SessionsChart({
  data,
}: {
  data: { date: string; sessions: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          tickFormatter={(d) => String(d).slice(5)}
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} width={40} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="sessions"
          stroke="#2F62D9"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ChannelChart({
  data,
}: {
  data: { channel: string; sessions: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
      >
        <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7280" }} />
        <YAxis
          type="category"
          dataKey="channel"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          width={96}
        />
        <Tooltip />
        <Bar dataKey="sessions" fill="#23346F" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// MRR over time, from daily snapshots. The growth story the point-in-time MRR
// number can't tell on its own.
export function MrrTrendChart({
  data,
  currency,
}: {
  data: { date: string; mrr: number }[];
  currency: string;
}) {
  const fmtAxis = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency.toUpperCase(),
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n || 0);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          tickFormatter={(d) => String(d).slice(5)}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6B7280" }}
          width={52}
          tickFormatter={fmtAxis}
          domain={["auto", "auto"]}
        />
        <Tooltip formatter={(v: number) => fmtAxis(v)} />
        <Line
          type="monotone"
          dataKey="mrr"
          stroke="#1F9D62"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Weekly demo (the gating conversion) vs sign-in clicks. Two y-axes because the
// scales differ by ~20x — demo would otherwise flatline against sign-ins.
export function WebsiteTrendChart({
  data,
}: {
  data: { week: string; demo: number; signin: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          tickFormatter={(d) => String(d).slice(5)}
          minTickGap={16}
        />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#6B7280" }} width={36} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          width={28}
          allowDecimals={false}
        />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="signin" name="Sign-ins" fill="#E7EEFC" radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="demo"
          name="Demo clicks"
          stroke="#2F62D9"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
