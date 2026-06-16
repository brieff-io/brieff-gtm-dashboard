"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
