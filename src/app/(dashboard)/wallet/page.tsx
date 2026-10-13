"use client"

import { Suspense, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  Search,
  Plus,
  Upload,
  RotateCcw,
  Gift,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Copy,
  Coins,
  Clock,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Hourglass,
  TimerOff,
} from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWalletTransactions, useAdminCredit, useAdminDebit, useWalletStats, useResolveWalletUser } from "@/hooks/useWallet"
import { BulkCreditDialog } from "@/components/wallet/BulkCreditDialog"
import { useDebounce } from "@/hooks/useDebounce"
import { formatINR } from "@/lib/utils"
import { usePermissions } from "@/hooks/usePermissions"
import type { ResolvedWalletUser } from "@/services/wallet.service"

type TypeTab = "all" | "CREDIT" | "DEBIT" | "REFUND"

function WalletContent() {
  const [typeFilter, setTypeFilter] = useState<TypeTab>("all")
  const [page, setPage] = useState(1)
  const [userIdSearch, setUserIdSearch] = useState("")
  const [creditOpen, setCreditOpen] = useState(false)
  const [debitOpen, setDebitOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [creditForm, setCreditForm] = useState({
    userId: "",
    amount: 0,
    description: "",
    isBonus: false,
    expiryDays: "",
  })
  const [debitForm, setDebitForm] = useState({
    userId: "",
    amount: 0,
    description: "",
  })

  const debouncedUserId = useDebounce(userIdSearch, 400)
  const { data: walletStats } = useWalletStats()

  // Resolve whatever's typed into the Credit/Debit "User ID" fields (a UUID
  // or a phone number) to a real name/phone, so the admin can confirm who
  // they're about to act on before submitting instead of pasting a bare
  // UUID blind.
  const debouncedCreditUserId = useDebounce(creditForm.userId, 400)
  const debouncedDebitUserId = useDebounce(debitForm.userId, 400)
  const { data: creditUserMatch, isFetching: creditUserLookupPending } =
    useResolveWalletUser(debouncedCreditUserId)
  const { data: debitUserMatch, isFetching: debitUserLookupPending } =
    useResolveWalletUser(debouncedDebitUserId)

  const { data, isLoading } = useWalletTransactions({
    page,
    limit: 20,
    type: typeFilter === "all" ? undefined : typeFilter,
    userId: debouncedUserId || undefined,
  })

  const transactions = data?.data ?? []
  const pagination = data?.pagination
  const totalPages = pagination?.totalPages ?? 1

  const creditMutation = useAdminCredit()
  const debitMutation = useAdminDebit()
  const { can } = usePermissions()
  const canManage = can("wallet.manage")

  const handleCredit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!creditForm.userId || creditForm.amount <= 0) return
    // Prefer the resolved user's real id — covers the case where a phone
    // number was typed instead of a UUID.
    creditMutation.mutate(
      {
        userId: creditUserMatch?.id ?? creditForm.userId,
        payload: {
          amount: creditForm.amount,
          description: creditForm.description || (creditForm.isBonus ? "Bonus credit" : "Admin credit"),
          ...(creditForm.isBonus
            ? {
                isBonus: true,
                ...(Number(creditForm.expiryDays) > 0
                  ? { expiryDays: Math.floor(Number(creditForm.expiryDays)) }
                  : {}),
              }
            : {}),
        },
      },
      {
        onSuccess: () => {
          setCreditOpen(false)
          setCreditForm({ userId: "", amount: 0, description: "", isBonus: false, expiryDays: "" })
        },
      }
    )
  }

  const handleDebit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!debitForm.userId || debitForm.amount <= 0) return
    // Prefer the resolved user's real id — covers the case where a phone
    // number was typed instead of a UUID.
    debitMutation.mutate(
      {
        userId: debitUserMatch?.id ?? debitForm.userId,
        payload: {
          amount: debitForm.amount,
          description: debitForm.description || "Amount deducted by company",
        },
      },
      {
        onSuccess: () => {
          setDebitOpen(false)
          setDebitForm({ userId: "", amount: 0, description: "" })
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Wallet & Transactions" subtitle="View wallet transactions and credit user wallets">
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)} size="sm">
              <Upload className="h-4 w-4 mr-1.5" /> Bulk Credit CSV
            </Button>
            <Button variant="outline" onClick={() => setDebitOpen(true)} size="sm">
              <ArrowDownCircle className="h-4 w-4 mr-1.5" /> Debit Wallet
            </Button>
            <Button onClick={() => setCreditOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Credit Wallet
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
              <Wallet className="h-5 w-5 text-brand-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Balance</p>
              <p className="text-lg font-bold">{formatINR(walletStats?.totalBalance ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Added</p>
              <p className="text-lg font-bold text-green-600">{formatINR(walletStats?.totalAdded ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Used</p>
              <p className="text-lg font-bold text-red-600">{formatINR(walletStats?.totalUsed ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
              <RotateCcw className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Refunded</p>
              <p className="text-lg font-bold text-blue-600">{formatINR(walletStats?.totalRefunded ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring bonus / cashback */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
              <Hourglass className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiring balance</p>
              <p className="text-lg font-bold text-amber-600">{formatINR(walletStats?.expiringBalance ?? 0)}</p>
              <p className="text-[11px] text-muted-foreground">Bonus &amp; cashback that will lapse</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiring in 7 days</p>
              <p className="text-lg font-bold text-orange-600">{formatINR(walletStats?.expiringIn7Days ?? 0)}</p>
              <p className="text-[11px] text-muted-foreground">Customers get a reminder before this</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950">
              <TimerOff className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expired unused</p>
              <p className="text-lg font-bold text-rose-600">{formatINR(walletStats?.totalExpired ?? 0)}</p>
              <p className="text-[11px] text-muted-foreground">
                {formatINR(walletStats?.expiredLast30Days ?? 0)} in the last 30 days
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by user ID or phone number..."
            className="pl-9 font-mono text-xs"
            value={userIdSearch}
            onChange={(e) => { setUserIdSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Tabs value={typeFilter} onValueChange={(v) => { setTypeFilter(v as TypeTab); setPage(1) }}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="CREDIT">Credits</TabsTrigger>
            <TabsTrigger value="DEBIT">Debits</TabsTrigger>
            <TabsTrigger value="REFUND">Refunds</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Transactions table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="hidden lg:table-cell">Reference</TableHead>
              <TableHead className="hidden md:table-cell">Balance After</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={<Wallet className="h-6 w-6 text-muted-foreground" />}
                    title="No transactions"
                    description={
                      userIdSearch
                        ? "No transactions found for this user"
                        : "No wallet transactions yet"
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((txn) => (
                <TableRow key={txn.id} className="group">
                  <TableCell>
                    {txn.status === "PENDING" ? (
                      <Badge
                        variant="default"
                        className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        title="Razorpay order created but payment not yet confirmed — no money has moved on our side"
                      >
                        <Clock className="h-3 w-3 mr-1" /> Pending
                      </Badge>
                    ) : txn.status === "FAILED" ? (
                      <Badge
                        variant="default"
                        className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        title="Payment was never completed — customer was not charged"
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Failed
                      </Badge>
                    ) : txn.subType === "REFUND" ? (
                      <Badge
                        variant="default"
                        className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Refund
                      </Badge>
                    ) : txn.subType === "EXPIRY" ? (
                      <Badge
                        variant="default"
                        className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        title="Bonus/cashback that was not used before its expiry date"
                      >
                        <TimerOff className="h-3 w-3 mr-1" /> Expired
                      </Badge>
                    ) : txn.subType === "BONUS" ? (
                      <Badge
                        variant="default"
                        className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      >
                        <Gift className="h-3 w-3 mr-1" /> Bonus
                      </Badge>
                    ) : txn.subType === "SCRATCH" ? (
                      <Badge
                        variant="default"
                        className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      >
                        <Sparkles className="h-3 w-3 mr-1" /> Scratch
                      </Badge>
                    ) : txn.subType === "CASHBACK" ? (
                      <Badge
                        variant="default"
                        className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        <Coins className="h-3 w-3 mr-1" /> Cashback
                      </Badge>
                    ) : txn.type === "CREDIT" ? (
                      <Badge
                        variant="default"
                        className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      >
                        <ArrowUpCircle className="h-3 w-3 mr-1" /> Credit
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      >
                        <ArrowDownCircle className="h-3 w-3 mr-1" /> Debit
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate max-w-[120px]">
                          {txn.userName || "Unknown"}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {txn.userPhone || (txn.userId ? txn.userId.slice(0, 8) + "…" : "—")}
                        </p>
                      </div>
                      {txn.userId && (
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted flex-shrink-0"
                          title="Copy User ID"
                          onClick={() => {
                            navigator.clipboard.writeText(txn.userId!)
                          }}
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-semibold ${
                        txn.status && txn.status !== "COMPLETED"
                          ? "text-muted-foreground"
                          : txn.type === "CREDIT"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                    >
                      {txn.type === "CREDIT" ? "+" : "-"}
                      {formatINR(txn.amount)}
                    </span>
                    {txn.expiresAt && (
                      <p
                        className={`text-[10px] ${
                          new Date(txn.expiresAt) <= new Date()
                            ? "text-rose-600"
                            : "text-amber-600"
                        }`}
                      >
                        {new Date(txn.expiresAt) <= new Date() ? "Expired " : "Expires "}
                        {new Date(txn.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                    {txn.description || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {txn.referenceId ? (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {txn.referenceId}
                      </code>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {txn.balanceAfter == null ? "—" : formatINR(txn.balanceAfter)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(txn.createdAt).toLocaleDateString()}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {new Date(txn.createdAt).toLocaleTimeString()}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({pagination?.total ?? 0} transactions)
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Admin Credit Dialog */}
      <Dialog open={creditOpen} onOpenChange={(v) => !v && setCreditOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Credit User Wallet</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCredit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="userId">User ID or phone number *</Label>
              <Input
                id="userId"
                placeholder="Enter user UUID or phone number"
                value={creditForm.userId}
                onChange={(e) => setCreditForm({ ...creditForm, userId: e.target.value })}
                required
                className="font-mono text-xs"
              />
              <UserLookupCaption
                query={debouncedCreditUserId}
                match={creditUserMatch}
                isFetching={creditUserLookupPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                max={50000}
                step={0.01}
                value={creditForm.amount || ""}
                onChange={(e) =>
                  setCreditForm({ ...creditForm, amount: parseFloat(e.target.value) || 0 })
                }
                required
              />
              <UnpaidOrderWarning amount={creditForm.amount} match={creditUserMatch} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="e.g. Refund for order #1234"
                value={creditForm.description}
                onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="rounded-lg border px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="isBonus" className="text-sm">Expiring bonus</Label>
                  <p className="text-xs text-muted-foreground">
                    {creditForm.isBonus
                      ? "Promotional credit — it expires if the customer doesn't use it in time."
                      : "Plain money (refund / correction) — never expires."}
                  </p>
                </div>
                <Switch
                  id="isBonus"
                  checked={creditForm.isBonus}
                  onCheckedChange={(v) => setCreditForm({ ...creditForm, isBonus: v })}
                />
              </div>
              {creditForm.isBonus && (
                <div className="space-y-1">
                  <Label htmlFor="expiryDays" className="text-xs">Valid for (days)</Label>
                  <Input
                    id="expiryDays"
                    type="number"
                    min={1}
                    max={3650}
                    step={1}
                    placeholder="Default from Wallet Settings"
                    value={creditForm.expiryDays}
                    onChange={(e) => setCreditForm({ ...creditForm, expiryDays: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the &quot;Admin bonus&quot; validity in Settings → Wallet. Has no effect
                    if expiry is switched off there.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creditMutation.isPending}>
                {creditMutation.isPending ? "Processing..." : "Credit Wallet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Debit Dialog */}
      <Dialog open={debitOpen} onOpenChange={(v) => !v && setDebitOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Debit User Wallet</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDebit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="debitUserId">User ID or phone number *</Label>
              <Input
                id="debitUserId"
                placeholder="Enter user UUID or phone number"
                value={debitForm.userId}
                onChange={(e) => setDebitForm({ ...debitForm, userId: e.target.value })}
                required
                className="font-mono text-xs"
              />
              <UserLookupCaption
                query={debouncedDebitUserId}
                match={debitUserMatch}
                isFetching={debitUserLookupPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debitAmount">Amount (₹) *</Label>
              <Input
                id="debitAmount"
                type="number"
                min={1}
                max={50000}
                step={0.01}
                value={debitForm.amount || ""}
                onChange={(e) =>
                  setDebitForm({ ...debitForm, amount: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debitDesc">Note (optional)</Label>
              <Textarea
                id="debitDesc"
                placeholder="e.g. Correction for order #1234"
                value={debitForm.description}
                onChange={(e) => setDebitForm({ ...debitForm, description: e.target.value })}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                If left blank, the customer will see &quot;Amount deducted by company&quot; in their wallet history.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDebitOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={debitMutation.isPending}>
                {debitMutation.isPending ? "Processing..." : "Debit Wallet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Credit Dialog */}
      <BulkCreditDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="table" />}>
      <WalletContent />
    </Suspense>
  )
}

/**
 * Confirmation caption shown under the Credit/Debit "User ID or phone
 * number" field — resolves whatever's been typed to a real name/phone so
 * an admin can see who they're about to act on before submitting, rather
 * than pasting an id blind. `query` is expected to already be debounced.
 */
function UserLookupCaption({
  query,
  match,
  isFetching,
}: {
  query: string
  match: ResolvedWalletUser | null | undefined
  isFetching: boolean
}) {
  if (query.trim().length < 3) return null

  if (isFetching) {
    return <p className="text-xs text-muted-foreground">Looking up user...</p>
  }

  if (match) {
    return (
      <p className="text-xs text-green-600 flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {match.name || "Unnamed customer"} · {match.phone}
      </p>
    )
  }

  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      <AlertCircle className="h-3.5 w-3.5" />
      No user found for this ID or phone number
    </p>
  )
}

/**
 * Warns when a Credit Wallet amount doesn't match any of this customer's
 * recent actually-PAID orders — catches the mistake of crediting a
 * "refund" for an order that was never paid for (a COD order cancelled
 * before delivery, or an ONLINE order whose payment window expired
 * unpaid), which looks identical to a real refund in the wallet history
 * but never had matching money collected in the first place. Purely
 * informational — legitimate free-form credits (bonuses, promotions,
 * goodwill) aren't tied to any order and are expected to not match.
 */
function UnpaidOrderWarning({
  amount,
  match,
}: {
  amount: number
  match: ResolvedWalletUser | null | undefined
}) {
  if (!match || !amount || amount <= 0) return null

  const matchesPaidOrder = match.recentPaidOrders.some(
    (o) => Math.abs(o.amount - amount) < 0.005
  )
  if (matchesPaidOrder) return null

  return (
    <p className="text-xs text-amber-600 flex items-center gap-1">
      <AlertCircle className="h-3.5 w-3.5" />
      ₹{amount} doesn&apos;t match any of {match.name || "this customer"}&apos;s recent paid
      orders — if this is a refund, double-check the order was actually paid for before
      crediting.
    </p>
  )
}
