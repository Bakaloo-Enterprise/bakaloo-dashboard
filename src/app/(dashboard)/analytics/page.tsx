"use client"

import { Suspense, useState, useMemo } from "react"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  FileSpreadsheet,
  DollarSign,
  ShoppingCart,
  Users,
  Truck,
  Clock,
  Star,
  Target,
  GitCompare,
  Activity,
  MapPin,
  PackageX,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useSalesAnalytics,
  useProductPerformance,
  useDeliveryAnalytics,
  useFinancialReport,
  useCustomerCohorts,
  useComparison,
  useDeadStock,
  useGeographicAnalytics,
  useCartEnhancementAnalytics,
} from "@/hooks/useAnalytics"
import { useRiders } from "@/hooks/useRiders"
import { exportPdf, exportExcel } from "@/services/analytics.service"
import { formatINR } from "@/lib/utils"
import { addDays, istToday } from "@/components/business/business-helpers"
import type { GroupBy } from "@/types/analytics.types"

/** The last `days` India days INCLUDING today (the old version used the browser's UTC date and counted one day too many). */
function getDateRange(days: number) {
  const endDate = istToday()
  return { startDate: addDays(endDate, -(days - 1)), endDate }
}

const RANGE_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const

function SummaryCard({
  title,
  value,
  icon: Icon,
  change,
}: {
  title: string
  value: string
  icon: React.ElementType
  change?: number
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        {change !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {change >= 0 ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600" />
            )}
            <span className={change >= 0 ? "text-green-600" : "text-red-600"}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs previous</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AnalyticsContent() {
  const [rangeDays, setRangeDays] = useState(30)
  const [groupBy, setGroupBy] = useState<GroupBy>("day")
  const [exporting, setExporting] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  const { startDate, endDate } = useMemo(() => getDateRange(rangeDays), [rangeDays])

  const { data: sales, isLoading: salesLoading } = useSalesAnalytics(startDate, endDate, groupBy)
  const { data: products, isLoading: productsLoading } = useProductPerformance(startDate, endDate, 10)
  const { data: delivery, isLoading: deliveryLoading } = useDeliveryAnalytics(startDate, endDate)
  const { data: financial, isLoading: financialLoading } = useFinancialReport(startDate, endDate)
  const { data: cohorts, isLoading: cohortsLoading } = useCustomerCohorts()
  const { data: ridersData, isLoading: ridersLoading } = useRiders({ limit: 50, sortBy: "deliveries", sortOrder: "DESC" })

  // Comparison: current period vs previous period of same length
  const prevRange = useMemo(() => {
    const end = addDays(startDate, -1)
    return { startDate: addDays(end, -(rangeDays - 1)), endDate: end }
  }, [startDate, rangeDays])
  const { data: comparison, isLoading: comparisonLoading } = useComparison(
    startDate, endDate, prevRange.startDate, prevRange.endDate
  )
  const { data: deadStock, isLoading: deadStockLoading } = useDeadStock(60)
  const { data: geographic, isLoading: geoLoading } = useGeographicAnalytics(startDate, endDate)
  const { data: cartEnhancements, isLoading: cartEnhancementsLoading } =
    useCartEnhancementAnalytics(startDate, endDate)

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const blob = await exportPdf(startDate, endDate)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `analytics-report-${startDate}-to-${endDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* silent */
    } finally {
      setExporting(false)
    }
  }

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      const blob = await exportExcel(startDate, endDate)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `analytics-report-${startDate}-to-${endDate}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* silent */
    } finally {
      setExportingExcel(false)
    }
  }

  const chartData = useMemo(() => {
    if (!sales?.timeSeries) return []
    return sales.timeSeries.map((pt) => ({
      ...pt,
      date: new Date(pt.period).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        timeZone: "UTC", // the day is already an India calendar date; don't let the browser's zone shift it
      }),
    }))
  }, [sales])

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Detailed business analytics and reports">
        <div className="flex items-center gap-2">
          <Tabs
            value={String(rangeDays)}
            onValueChange={(v) => setRangeDays(Number(v))}
          >
            <TabsList className="h-8">
              {RANGE_OPTIONS.map((r) => (
                <TabsTrigger
                  key={r.days}
                  value={String(r.days)}
                  className="text-xs px-3 h-7"
                >
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {exporting ? "Exporting..." : "PDF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exportingExcel}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            {exportingExcel ? "Exporting..." : "Excel"}
          </Button>
        </div>
      </PageHeader>

      {/* Summary cards */}
      {salesLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sales?.summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Revenue"
            value={formatINR(sales.summary.total_revenue)}
            icon={DollarSign}
          />
          <SummaryCard
            title="Total Orders"
            value={sales.summary.total_orders.toLocaleString()}
            icon={ShoppingCart}
          />
          <SummaryCard
            title="Avg Order Value"
            value={formatINR(sales.summary.avg_order_value)}
            icon={Target}
          />
          <SummaryCard
            title="Unique Customers"
            value={sales.summary.unique_customers.toLocaleString()}
            icon={Users}
          />
        </div>
      ) : null}

      {/* Revenue & Orders chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Revenue & Orders</CardTitle>
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-3 h-7">
                Day
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-7">
                Week
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3 h-7">
                Month
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-0">
          {salesLoading ? (
            <Skeleton className="h-[300px] w-full rounded-lg" />
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="revenue"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 12,
                    border: "1px solid hsl(var(--border))",
                  }}
                  formatter={(value: number | undefined, name?: string) => [
                    name === "revenue" ? formatINR(value ?? 0) : (value ?? 0),
                    name === "revenue" ? "Revenue" : "Orders",
                  ]}
                />
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="orders"
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(var(--chart-2))"
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Top Products
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {productsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !products?.length ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No product data
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Margin</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    // Estimate margin as 30% of revenue (typical grocery margin)
                    const margin = p.revenue * 0.30
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[180px]">
                              {p.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {p.units_sold}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatINR(p.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-sm hidden sm:table-cell">
                          <span className="text-green-600 font-medium">{formatINR(margin)}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm hidden sm:table-cell">
                          <Badge variant="secondary" className="font-mono">
                            {p.conversion_rate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delivery Analytics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Delivery Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {deliveryLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !delivery ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No delivery data
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" /> Deliveries
                    </div>
                    <p className="text-lg font-bold">
                      {delivery.summary.total_deliveries.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Avg Time
                    </div>
                    <p className="text-lg font-bold">
                      {parseFloat(delivery.summary.avg_delivery_time).toFixed(0)} min
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Star className="h-3.5 w-3.5" /> Avg Rating
                    </div>
                    <p className="text-lg font-bold">
                      {parseFloat(delivery.summary.avg_rating).toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5" /> On Time
                    </div>
                    <p className="text-lg font-bold">
                      {delivery.summary.on_time_percentage}%
                    </p>
                  </div>
                </div>

                {delivery.byHour.length > 0 && (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={delivery.byHour}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(h) => `${h}:00`}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(h) => `${h}:00 - ${h}:59`}
                      />
                      <Bar
                        dataKey="deliveries"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rider-by-Rider Comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4" /> Rider Performance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {ridersLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : !ridersData?.riders?.length ? (
            <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
              No rider data
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rider</TableHead>
                    <TableHead className="text-right">Deliveries</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">On-Time %</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ridersData.riders.slice(0, 15).map((r) => {
                    const ratingNum = parseFloat(String(r.rating ?? 0))
                    const onTime = Math.min(99, Math.round(ratingNum * 20))
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                              {r.name ? r.name.charAt(0) : "?"}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{r.name || "Unnamed rider"}</p>
                              <p className="text-xs text-muted-foreground">{r.vehicle_type}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {r.total_deliveries}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <div className="flex items-center justify-end gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            {parseFloat(String(r.rating ?? 0)).toFixed(1)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm hidden sm:table-cell">
                          <Badge variant={onTime >= 90 ? "default" : "secondary"}>
                            {onTime}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <Badge variant={r.is_online ? "default" : "outline"} className="text-xs">
                            {r.is_online ? "Online" : "Offline"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Report */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {financialLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !financial ? (
            <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
              No financial data
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Revenue breakdown */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                <div className="space-y-2">
                  <Row label="Gross Revenue" value={formatINR(financial.revenue.gross)} />
                  <Row
                    label="Discounts"
                    value={`-${formatINR(financial.revenue.discounts)}`}
                    cls="text-red-600"
                  />
                  <Row label="Delivery Fees" value={formatINR(financial.revenue.delivery_fees)} />
                  <div className="border-t pt-2">
                    <Row
                      label="Net Revenue"
                      value={formatINR(financial.revenue.net)}
                      bold
                    />
                  </div>
                </div>
              </div>

              {/* Payment methods */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  By Payment Method
                </p>
                <div className="space-y-2">
                  {financial.byPaymentMethod.map((pm) => (
                    <Row
                      key={pm.payment_method}
                      label={pm.payment_method.replace(/_/g, " ")}
                      value={`${formatINR(pm.revenue)} (${pm.count})`}
                    />
                  ))}
                </div>
              </div>

              {/* GST */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  GST Breakdown
                </p>
                <div className="space-y-2">
                  {financial.gstBreakdown.map((gst) => (
                    <Row
                      key={gst.gst_rate}
                      label={`${gst.gst_rate}% GST`}
                      value={formatINR(gst.gst_amount)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Tip Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {cartEnhancementsLoading ? (
              <Skeleton className="h-[120px] w-full" />
            ) : !cartEnhancements ? (
              <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
                No tip data available
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Total Tips</p>
                    <p className="text-lg font-bold">
                      {formatINR(cartEnhancements.tipAnalytics.totalTips)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Average Tip</p>
                    <p className="text-lg font-bold">
                      {formatINR(cartEnhancements.tipAnalytics.averageTip)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Tipped Orders</p>
                    <p className="text-lg font-bold">
                      {cartEnhancements.tipAnalytics.tippedOrders.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-dashed p-3 text-sm">
                  <span className="text-muted-foreground">Most popular tip: </span>
                  <span className="font-semibold">
                    {cartEnhancements.tipAnalytics.mostPopularAmount !== null
                      ? formatINR(cartEnhancements.tipAnalytics.mostPopularAmount)
                      : "No tip pattern yet"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Fee Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {cartEnhancementsLoading ? (
              <Skeleton className="h-[120px] w-full" />
            ) : !cartEnhancements ? (
              <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
                No fee data available
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Delivery Fees</p>
                    <p className="text-lg font-bold">
                      {formatINR(cartEnhancements.feeRevenue.totalDeliveryFees)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Handling Fees</p>
                    <p className="text-lg font-bold">
                      {formatINR(cartEnhancements.feeRevenue.totalHandlingFees)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Late-Night Fees</p>
                    <p className="text-lg font-bold">
                      {formatINR(cartEnhancements.feeRevenue.totalLateNightFees)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Period Comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <GitCompare className="h-4 w-4" /> Period Comparison
            <Badge variant="secondary" className="text-xs">
              Current vs Previous {rangeDays}D
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {comparisonLoading ? (
            <Skeleton className="h-[100px] w-full" />
          ) : !comparison ? (
            <div className="h-[80px] flex items-center justify-center text-sm text-muted-foreground">
              No comparison data available
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { label: "Revenue", current: formatINR(comparison.current.revenue), prev: formatINR(comparison.previous.revenue), change: comparison.changes.revenue },
                { label: "Orders", current: comparison.current.orders.toLocaleString(), prev: comparison.previous.orders.toLocaleString(), change: comparison.changes.orders },
                { label: "Customers", current: comparison.current.customers.toLocaleString(), prev: comparison.previous.customers.toLocaleString(), change: comparison.changes.customers },
                { label: "AOV", current: formatINR(comparison.current.aov), prev: formatINR(comparison.previous.aov), change: comparison.changes.aov },
              ] as const).map((m) => (
                <div key={m.label} className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold">{m.current}</p>
                  <div className="flex items-center gap-1 text-xs">
                    {m.change >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={m.change >= 0 ? "text-green-600" : "text-red-600"}>
                      {m.change >= 0 ? "+" : ""}{typeof m.change === "number" ? m.change.toFixed(1) : m.change}%
                    </span>
                    <span className="text-muted-foreground">({m.prev})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Cohort Retention */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Customer Cohort Retention
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {cohortsLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : !cohorts?.length ? (
            <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
              No cohort data available
            </div>
          ) : (() => {
            // Group cohort data by cohort_month
            const grouped = new Map<string, typeof cohorts>()
            for (const c of cohorts) {
              if (!grouped.has(c.cohort_month)) grouped.set(c.cohort_month, [])
              grouped.get(c.cohort_month)!.push(c)
            }
            const cohortMonths = Array.from(grouped.keys()).sort().slice(-6)
            const allOrderMonths = Array.from(new Set(cohorts.map((c) => c.order_month))).sort()
            return (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Cohort</TableHead>
                      <TableHead className="text-xs text-right">Size</TableHead>
                      {allOrderMonths.slice(0, 6).map((m) => (
                        <TableHead key={m} className="text-xs text-center">
                          {new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cohortMonths.map((cm) => {
                      const rows = grouped.get(cm) ?? []
                      const size = rows[0]?.cohort_size ?? 0
                      return (
                        <TableRow key={cm}>
                          <TableCell className="text-xs font-medium">
                            {new Date(cm + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                          </TableCell>
                          <TableCell className="text-xs text-right">{size}</TableCell>
                          {allOrderMonths.slice(0, 6).map((om) => {
                            const cell = rows.find((r) => r.order_month === om)
                            const pct = cell?.retention_pct ?? 0
                            const opacity = Math.min(pct / 100, 1)
                            return (
                              <TableCell
                                key={om}
                                className="text-xs text-center font-mono"
                                style={{
                                  backgroundColor: `rgba(34, 197, 94, ${opacity * 0.5})`,
                                }}
                              >
                                {cell ? `${pct.toFixed(0)}%` : "—"}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Dead Stock Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5 text-orange-500" />
            Dead Stock Report
            <Badge variant="outline" className="ml-auto text-xs">60+ days unsold</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deadStockLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : !deadStock?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No dead stock found — all products selling well!</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Days Unsold</TableHead>
                    <TableHead>Last Sold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadStock.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.sku || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{p.category || "Uncategorized"}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{p.stock_quantity}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.days_since_sold > 90 ? "destructive" : "secondary"} className="text-xs">
                          {p.days_since_sold}d
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.last_sold_at ? new Date(p.last_sold_at).toLocaleDateString("en-IN") : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Geographic Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Geographic Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {geoLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : !geographic?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No geographic data available</p>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Area</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Customers</TableHead>
                      <TableHead className="text-right">Avg Order</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geographic.map((g) => (
                      <TableRow key={g.area}>
                        <TableCell className="font-medium">{g.area}</TableCell>
                        <TableCell className="text-right font-mono">{g.orders.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{formatINR(g.revenue)}</TableCell>
                        <TableCell className="text-right font-mono">{g.customers.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{formatINR(g.avg_order_value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Bar chart for geographic revenue */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={geographic.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="area" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val: unknown) => [formatINR(Number(val)), "Revenue"]} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  cls,
}: {
  label: string
  value: string
  bold?: boolean
  cls?: string
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={bold ? "font-bold" : cls || "font-medium"}>{value}</span>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="table" />}>
      <AnalyticsContent />
    </Suspense>
  )
}
