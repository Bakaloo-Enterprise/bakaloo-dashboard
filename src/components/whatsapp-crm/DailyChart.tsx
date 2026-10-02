"use client"

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { AnalyticsDay } from "@/types/whatsapp-crm.types"
import { formatRupees, shortDay } from "./analytics-helpers"

export type ChartMetric = "messages" | "orders" | "cost"

/** Loaded with next/dynamic so Recharts stays out of the first page load. */
export default function DailyChart({ data, metric }: { data: AnalyticsDay[]; metric: ChartMetric }) {
  const rows = data.map((d) => ({ ...d, label: shortDay(d.day) }))
  const axis = { fontSize: 11 }
  return (
    <ResponsiveContainer width="100%" height={260}>
      {metric === "orders" ? (
        <BarChart data={rows} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" />
          <YAxis yAxisId="o" tick={axis} allowDecimals={false} />
          <YAxis yAxisId="r" orientation="right" tick={axis} tickFormatter={(v) => formatRupees(Number(v), { compact: true })} />
          <Tooltip formatter={(v, k) => (k === "Revenue" ? formatRupees(Number(v)) : String(v))} />
          <Legend />
          <Bar yAxisId="o" dataKey="orders" name="Orders" fill="#1A7A3C" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="r" dataKey="revenue" name="Revenue" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
        </BarChart>
      ) : metric === "cost" ? (
        <BarChart data={rows} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" />
          <YAxis tick={axis} tickFormatter={(v) => formatRupees(Number(v), { compact: true })} />
          <Tooltip formatter={(v) => formatRupees(Number(v))} />
          <Bar dataKey="cost" name="Cost" fill="#F59E0B" radius={[3, 3, 0, 0]} />
        </BarChart>
      ) : (
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" />
          <YAxis tick={axis} allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="sent" name="Sent" stroke="#64748B" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="delivered" name="Delivered" stroke="#1A7A3C" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="read" name="Read" stroke="#0EA5E9" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="replied" name="Replied" stroke="#8B5CF6" dot={false} strokeWidth={2} />
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}
