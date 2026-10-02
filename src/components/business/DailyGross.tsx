"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatRupees, shortDate } from "./business-helpers"
import type { Overview } from "@/types/business.types"

/** Loaded with next/dynamic so Recharts stays out of the first page load. */
export default function DailyGross({ data }: { data: Overview["series"] }) {
  const rows = data.map((d) => ({ ...d, label: shortDate(d.day) }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatRupees(Number(v), { compact: true })} />
        <Tooltip formatter={(v) => formatRupees(Number(v))} />
        <Bar dataKey="gross" name="Gross sales" fill="#1A7A3C" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
