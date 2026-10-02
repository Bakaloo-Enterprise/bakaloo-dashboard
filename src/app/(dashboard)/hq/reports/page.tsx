"use client"

/**
 * HQ Reports page (task 20.5) — 12 report types with date range, shop filter, CSV export.
 *
 * Uses `useHQReportTypes` to fetch available report types and `useHQReport`
 * to generate reports on demand. CSV export via blob URL download.
 */

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  BarChart3,
  Download,
  FileText,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import { ErrorBlock } from "@/components/shared/error-block"
import { PageHeader } from "@/components/shared/PageHeader"

import { useHQReportTypes, useHQReport } from "@/hooks/useHQ"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { hqService } from "@/services/hq.service"
import type { HQReportFilters } from "@/services/hq.service"

// Shown only if the report list cannot be loaded; same ids the backend runs.
const FALLBACK_REPORT_TYPES = [
  { id: "gmv", name: "GMV", description: "Gross merchandise value by day" },
  { id: "orders", name: "Orders", description: "Order counts and status breakdown" },
  { id: "revenue", name: "Revenue", description: "Gross, refunded and net revenue by day" },
  { id: "refunds", name: "Refunds", description: "Refund counts and amounts by day" },
  { id: "shop-performance", name: "Shop Performance", description: "Per-shop KPIs comparison" },
  { id: "top-shops", name: "Top Shops", description: "Best performing shops" },
  { id: "top-products", name: "Top Products", description: "Top selling products" },
  { id: "low-stock", name: "Low Stock", description: "Products with 10 or fewer units left" },
  { id: "rider-performance", name: "Rider Performance", description: "Delivery metrics per rider" },
  { id: "coupon-usage", name: "Coupon Usage", description: "Coupon redemption and discount given" },
  { id: "payouts", name: "Payouts", description: "Shop payout history" },
  { id: "customer-acquisition", name: "Customer Acquisition", description: "New customers in the period" },
]

const reportFiltersSchema = z.object({
  report_type: z.string().min(1, "Select a report type"),
  shop_id: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
})

type ReportFiltersForm = z.infer<typeof reportFiltersSchema>

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function HQReportsPage() {
  const [activeFilters, setActiveFilters] = useState<HQReportFilters | null>(null)
  const [exporting, setExporting] = useState(false)

  const { data: reportTypes } = useHQReportTypes()
  const { data: shopsData } = useActiveShopsForSwitcher()
  const shops = shopsData?.items ?? []
  const types = reportTypes ?? FALLBACK_REPORT_TYPES

  const reportQuery = useHQReport(
    activeFilters ?? { report_type: "", startDate: "", endDate: "" },
    activeFilters !== null,
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReportFiltersForm>({
    resolver: zodResolver(reportFiltersSchema),
    defaultValues: {
      report_type: "",
      shop_id: "",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
    },
  })

  const selectedType = watch("report_type")

  function onGenerate(values: ReportFiltersForm) {
    const filters: HQReportFilters = {
      report_type: values.report_type,
      startDate: values.startDate,
      endDate: values.endDate,
      ...(values.shop_id && { shop_id: values.shop_id }),
    }
    setActiveFilters(filters)
  }

  async function handleExportCSV() {
    if (!activeFilters) return
    setExporting(true)
    try {
      const blob = await hqService.exportReportCSV(activeFilters)
      downloadBlob(blob, `report-${activeFilters.report_type}-${activeFilters.startDate}.csv`)
      toast.success("Report exported")
    } catch {
      toast.error("Failed to export report")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HQ — Reports"
        subtitle="Generate and export cross-shop reports"
      />

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onGenerate)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="report_type">Report Type *</Label>
                <Select
                  value={selectedType}
                  onValueChange={(v) => setValue("report_type", v)}
                >
                  <SelectTrigger id="report_type" aria-label="Report type">
                    <SelectValue placeholder="Select report..." />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.report_type && (
                  <p className="text-xs text-destructive">{errors.report_type.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="shop_filter">Shop (optional)</Label>
                <Select
                  value={watch("shop_id") || "__all__"}
                  onValueChange={(v) => setValue("shop_id", v === "__all__" ? "" : v)}
                >
                  <SelectTrigger id="shop_filter" aria-label="Filter by shop">
                    <SelectValue placeholder="All Shops" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Shops</SelectItem>
                    {shops.map((shop) => (
                      <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" type="date" {...register("startDate")} />
                {errors.startDate && (
                  <p className="text-xs text-destructive">{errors.startDate.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="endDate">End Date *</Label>
                <Input id="endDate" type="date" {...register("endDate")} />
                {errors.endDate && (
                  <p className="text-xs text-destructive">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={reportQuery.isFetching}>
                {reportQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <FileText className="h-4 w-4 mr-1" />
                )}
                Generate Report
              </Button>
              {activeFilters && reportQuery.data && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  Export CSV
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Report Type Cards */}
      {!activeFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {types.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setValue("report_type", t.id)}
            >
              <CardContent className="p-4">
                <h3 className="text-sm font-medium">{t.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Report Results */}
      {activeFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Results — {types.find((t) => t.id === activeFilters.report_type)?.name ?? activeFilters.report_type}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : reportQuery.isError ? (
              <ErrorBlock
                message={(reportQuery.error as Error)?.message ?? "Failed to generate report"}
                onRetry={() => void reportQuery.refetch()}
              />
            ) : reportQuery.data && reportQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      {Object.keys(reportQuery.data[0]).map((key) => (
                        <th key={key} className="h-10 px-3 text-left font-medium text-muted-foreground">
                          {key.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportQuery.data.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/40">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2">
                            {val === null ? "—" : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No data for the selected filters
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
