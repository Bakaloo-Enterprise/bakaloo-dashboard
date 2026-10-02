"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  User,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Wallet,
  Star,
  Bell,
  ShieldBan,
  ShieldCheck,
  Loader2,
  Crown,
  Navigation,
  ArrowDownCircle,
  MessageCircle,
} from "lucide-react"
import {
  useCustomerDetail,
  useCustomerOrders,
  useCustomerAddresses,
  useToggleBlockCustomer,
  useCreditWallet,
  useDebitWallet,
  useNotifyCustomer,
} from "@/hooks/useCustomers"
import { useShopContextStore } from "@/store/shop-context.store"
import { useCrmMe } from "@/hooks/useWhatsappCrm"
import { useFeatureAccess } from "@/hooks/useFeatures"
import { CustomerMessages } from "./CustomerMessages"
import { CustomerWhatsappDialog } from "./CustomerWhatsappDialog"
import { formatINR, formatDate, formatRelativeTime } from "@/lib/utils"
import { STATUS_CONFIG, type OrderStatus } from "@/lib/constants"
import type { CustomerAddress } from "@/types"

interface CustomerProfileDrawerProps {
  customerId: string | null
  open: boolean
  onClose: () => void
}

export function CustomerProfileDrawer({ customerId, open, onClose }: CustomerProfileDrawerProps) {
  const { data: customer, isLoading } = useCustomerDetail(customerId)
  const { data: ordersData } = useCustomerOrders(customerId)
  const { data: addresses, isLoading: addressesLoading } = useCustomerAddresses(customerId)
  const activeAddresses = addresses?.filter((a) => !a.deletedAt) ?? []
  const removedAddresses = addresses?.filter((a) => a.deletedAt) ?? []
  const toggleBlock = useToggleBlockCustomer()
  const creditWallet = useCreditWallet()
  const debitWallet = useDebitWallet()
  const notifyCustomer = useNotifyCustomer()
  // WhatsApp CRM is locked until released: no CRM calls and no WhatsApp controls for people who cannot use it yet.
  const waFeature = useFeatureAccess("whatsapp_crm")
  const crm = useCrmMe(waFeature.canAccess)
  const [waDialog, setWaDialog] = useState(false)

  // Vendor scope enforcement (Req 10.10): a vendor (`assignedShopIds.length > 0`)
  // who opens a customer with no overlap between the customer's
  // `shop_allocations` and the vendor's locked shop list must see the 404
  // empty state rather than the underlying record. Super-admins
  // (`assignedShopIds = []`) bypass the check entirely. The check is
  // intentionally skipped while the detail is still loading so the loading
  // skeleton renders normally; once the response arrives, an empty
  // `shop_allocations` array (authoritative negative signal from the
  // backend) triggers the 404 path. A missing/`undefined` array is treated
  // as "not enforced" so the legacy unscoped /admin/customers response
  // does not regress before the backend ships the new field.
  const assignedShopIds = useShopContextStore((s) => s.assignedShopIds)
  const isVendor = assignedShopIds.length > 0
  const customerShopAllocations = customer?.shop_allocations
  const vendorHasAccess =
    !isVendor ||
    customerShopAllocations === undefined ||
    customerShopAllocations.some((id) => assignedShopIds.includes(id))
  const showNotFound = !isLoading && !!customer && !vendorHasAccess

  const [walletDialog, setWalletDialog] = useState(false)
  const [walletAmount, setWalletAmount] = useState("")
  const [walletDesc, setWalletDesc] = useState("")

  const [walletDebitDialog, setWalletDebitDialog] = useState(false)
  const [walletDebitAmount, setWalletDebitAmount] = useState("")
  const [walletDebitDesc, setWalletDebitDesc] = useState("")

  const [notifyDialog, setNotifyDialog] = useState(false)
  const [notifyTitle, setNotifyTitle] = useState("")
  const [notifyBody, setNotifyBody] = useState("")

  const handleCreditWallet = () => {
    if (!customer || !walletAmount) return
    creditWallet.mutate(
      { id: customer.id, amount: parseFloat(walletAmount), description: walletDesc || undefined },
      {
        onSuccess: () => {
          setWalletDialog(false)
          setWalletAmount("")
          setWalletDesc("")
        },
      }
    )
  }

  const debitAmountExceedsBalance =
    !!customer && !!walletDebitAmount && parseFloat(walletDebitAmount) > customer.wallet_balance

  const handleDebitWallet = () => {
    if (!customer || !walletDebitAmount || debitAmountExceedsBalance) return
    debitWallet.mutate(
      { id: customer.id, amount: parseFloat(walletDebitAmount), description: walletDebitDesc || undefined },
      {
        onSuccess: () => {
          setWalletDebitDialog(false)
          setWalletDebitAmount("")
          setWalletDebitDesc("")
        },
      }
    )
  }

  const handleNotify = () => {
    if (!customer || !notifyTitle || !notifyBody) return
    notifyCustomer.mutate(
      { id: customer.id, title: notifyTitle, body: notifyBody },
      {
        onSuccess: () => {
          setNotifyDialog(false)
          setNotifyTitle("")
          setNotifyBody("")
        },
      }
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-lg p-0">
          <SheetHeader className="px-6 pt-6 pb-3">
            <SheetTitle>
              {isLoading ? <Skeleton className="h-6 w-40" /> : "Customer Profile"}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="px-6 pb-6 space-y-5">
              {isLoading ? (
                <ProfileSkeleton />
              ) : showNotFound ? (
                <CustomerNotFound />
              ) : !customer ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Customer not found
                </div>
              ) : (
                <>
                  {/* Identity */}
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold truncate">
                          {customer.name ?? "Unnamed Customer"}
                        </h3>
                        {customer.is_blocked ? (
                          <Badge variant="destructive" className="text-[10px]">Blocked</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-green-50 text-green-600 border-0">Active</Badge>
                        )}
                        {(customer.order_count >= 10 || customer.total_spent >= 10000) && (
                          <Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            <Crown className="h-2.5 w-2.5 mr-0.5" /> VIP
                          </Badge>
                        )}
                        {customer.membership_tier && (
                          <Badge variant="outline" className="text-[10px]">{customer.membership_tier}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                        {customer.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Joined {formatDate(customer.created_at)} · {formatRelativeTime(customer.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    <StatBox icon={<ShoppingBag className="h-4 w-4" />} label="Orders" value={customer.order_count.toString()} />
                    <StatBox icon={<Wallet className="h-4 w-4" />} label="Spent" value={formatINR(customer.total_spent)} />
                    <StatBox icon={<Wallet className="h-4 w-4" />} label="Wallet" value={formatINR(customer.wallet_balance)} />
                    <StatBox icon={<Star className="h-4 w-4" />} label="Points" value={customer.loyalty_points.toString()} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => setWalletDialog(true)}
                    >
                      <Wallet className="h-3.5 w-3.5 mr-1" />
                      Credit Wallet
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => setWalletDebitDialog(true)}
                    >
                      <ArrowDownCircle className="h-3.5 w-3.5 mr-1" />
                      Debit Wallet
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => setNotifyDialog(true)}
                    >
                      <Bell className="h-3.5 w-3.5 mr-1" />
                      Send Notification
                    </Button>
                    {waFeature.canAccess && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setWaDialog(true)}
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1" />
                        WhatsApp Message
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={customer.is_blocked ? "default" : "destructive"}
                      className="text-xs h-8 ml-auto"
                      onClick={() => toggleBlock.mutate({ id: customer.id, blocked: !customer.is_blocked })}
                      disabled={toggleBlock.isPending}
                    >
                      {customer.is_blocked ? (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          Unblock
                        </>
                      ) : (
                        <>
                          <ShieldBan className="h-3.5 w-3.5 mr-1" />
                          Block
                        </>
                      )}
                    </Button>
                  </div>

                  <Separator />

                  {/* Messages sent to this customer */}
                  <CustomerMessages customerId={customer.id} canSeeWhatsapp={waFeature.canAccess && crm.can("crm.inbox.view")} />
                  <Separator />

                  {/* Addresses */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Addresses {activeAddresses.length > 0 && `(${activeAddresses.length})`}
                    </h4>
                    {addressesLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-16 rounded-lg" />
                        <Skeleton className="h-16 rounded-lg" />
                      </div>
                    ) : activeAddresses.length === 0 && removedAddresses.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No saved addresses</p>
                    ) : (
                      <div className="space-y-2">
                        {activeAddresses.map((addr) => (
                          <AddressCard key={addr.id} address={addr} />
                        ))}
                      </div>
                    )}

                    {removedAddresses.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                          Removed — kept for security review
                        </p>
                        <div className="space-y-2">
                          {removedAddresses.map((addr) => (
                            <AddressCard key={addr.id} address={addr} removed />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Separator />

                  {/* Recent Orders */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      Recent Orders
                    </h4>
                    {ordersData?.orders && ordersData.orders.length > 0 ? (
                      <div className="space-y-2">
                        {ordersData.orders.map((o) => {
                          const config = STATUS_CONFIG[o.status as OrderStatus]
                          return (
                            <div
                              key={o.id}
                              className="flex items-center justify-between p-2.5 rounded-lg border"
                            >
                              <div>
                                <p className="text-sm font-medium">#{o.order_number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(o.created_at)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold">{formatINR(o.total_amount)}</p>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-0"
                                  style={{
                                    backgroundColor: config?.bg,
                                    color: config?.text,
                                  }}
                                >
                                  {config?.label ?? o.status}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : customer.recent_orders && customer.recent_orders.length > 0 ? (
                      <div className="space-y-2">
                        {customer.recent_orders.map((o) => {
                          const config = STATUS_CONFIG[o.status as OrderStatus]
                          return (
                            <div
                              key={o.id}
                              className="flex items-center justify-between p-2.5 rounded-lg border"
                            >
                              <div>
                                <p className="text-sm font-medium">#{o.order_number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(o.created_at)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold">{formatINR(o.total_amount)}</p>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-0"
                                  style={{
                                    backgroundColor: config?.bg,
                                    color: config?.text,
                                  }}
                                >
                                  {config?.label ?? o.status}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No orders yet
                      </p>
                    )}
                  </div>

                  {/* Extra info */}
                  {(customer.platform || customer.app_version || customer.membership_tier) && (
                    <>
                      <Separator />
                      <div className="text-xs text-muted-foreground space-y-1">
                        {customer.platform && <p>Platform: {customer.platform}</p>}
                        {customer.app_version && <p>App Version: {customer.app_version}</p>}
                        {customer.membership_tier && (
                          <p>
                            Tier:{" "}
                            <Badge variant="outline" className="text-[10px]">
                              {customer.membership_tier}
                            </Badge>
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Wallet Credit Dialog */}
      <Dialog open={walletDialog} onOpenChange={setWalletDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Credit Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                max="50000"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input
                value={walletDesc}
                onChange={(e) => setWalletDesc(e.target.value)}
                placeholder="e.g. Refund for order #123"
                maxLength={255}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreditWallet}
              disabled={!walletAmount || creditWallet.isPending}
            >
              {creditWallet.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Credit {walletAmount ? formatINR(parseFloat(walletAmount)) : "₹0"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wallet Debit Dialog */}
      <Dialog open={walletDebitDialog} onOpenChange={setWalletDebitDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Debit Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {customer && (
              <p className="text-xs text-muted-foreground">
                Current balance: {formatINR(customer.wallet_balance)}
              </p>
            )}
            <div className="space-y-1">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                max="50000"
                value={walletDebitAmount}
                onChange={(e) => setWalletDebitAmount(e.target.value)}
                placeholder="e.g. 200"
              />
              {debitAmountExceedsBalance && (
                <p className="text-xs text-destructive">Amount exceeds current wallet balance.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Note (optional)</Label>
              <Input
                value={walletDebitDesc}
                onChange={(e) => setWalletDebitDesc(e.target.value)}
                placeholder="e.g. Correction for order #123"
                maxLength={255}
              />
              <p className="text-[10px] text-muted-foreground">
                If left blank, the customer will see &quot;Amount deducted by company&quot; in their wallet history.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletDebitDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDebitWallet}
              disabled={!walletDebitAmount || debitAmountExceedsBalance || debitWallet.isPending}
            >
              {debitWallet.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Debit {walletDebitAmount ? formatINR(parseFloat(walletDebitAmount)) : "₹0"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {customer && waFeature.canAccess && <CustomerWhatsappDialog key={customer.id} customer={{ id: customer.id, name: customer.name, phone: customer.phone }} open={waDialog} onOpenChange={setWaDialog} />}

      {/* Notify Dialog */}
      <Dialog open={notifyDialog} onOpenChange={setNotifyDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
                placeholder="e.g. Special offer for you!"
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <Label>Message</Label>
              <Input
                value={notifyBody}
                onChange={(e) => setNotifyBody(e.target.value)}
                placeholder="Notification body..."
                maxLength={1000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialog(false)}>Cancel</Button>
            <Button
              onClick={handleNotify}
              disabled={!notifyTitle || !notifyBody || notifyCustomer.isPending}
            >
              {notifyCustomer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * One saved address — active or removed. Removed cards are greyed out and
 * show the retention countdown instead of nothing, so an admin reviewing a
 * delivery dispute can still see exactly where an order shipped even after
 * the customer deleted the address (see `ADDRESS_RETENTION_DAYS` on the
 * backend). The map button links straight to Google Maps at the address's
 * exact lat/lng — the same "exact location" verification the order-detail
 * drawer offers for a delivered order.
 */
function AddressCard({ address, removed }: { address: CustomerAddress; removed?: boolean }) {
  const hasCoords = typeof address.lat === "number" && typeof address.lng === "number"
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}`
    : null

  return (
    <div
      className={`p-2.5 rounded-lg border text-xs space-y-0.5 ${
        removed ? "opacity-60 bg-muted/30" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{address.label}</span>
          {address.isDefault && !removed && (
            <Badge variant="outline" className="text-[9px] h-4">Default</Badge>
          )}
        </div>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:underline flex-shrink-0"
          >
            <Navigation className="h-3 w-3" />
            View on Map
          </a>
        )}
      </div>
      <p className="text-muted-foreground">
        {address.addressLine1}
        {address.addressLine2 && `, ${address.addressLine2}`}
      </p>
      {address.landmark && (
        <p className="text-muted-foreground">Landmark: {address.landmark}</p>
      )}
      <p className="text-muted-foreground">
        {address.city}
        {address.state && `, ${address.state}`} – {address.pincode}
      </p>
      {hasCoords && (
        <p className="text-muted-foreground font-mono text-[10px]">
          {address.lat!.toFixed(6)}, {address.lng!.toFixed(6)}
        </p>
      )}
      {removed && (
        <p className="text-[10px] text-amber-600 font-medium pt-0.5">
          Removed {formatRelativeTime(address.deletedAt!)}
          {address.daysUntilPurge != null &&
            ` · purges in ${address.daysUntilPurge}d`}
        </p>
      )}
    </div>
  )
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/50 text-center">
      <div className="flex justify-center text-muted-foreground mb-1">{icon}</div>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

/**
 * 404 state shown when a vendor user opens a customer that does not have an
 * allocation overlap with their `assignedShopIds` (Req 10.10). The textual
 * wording mirrors a generic "not found" so vendors cannot infer the
 * existence of customers outside their shop scope from the UX alone — the
 * drawer reads as a plain 404 rather than a "blocked" state.
 */
function CustomerNotFound() {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <User className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">404 — Customer not found</h3>
      <p className="text-xs text-muted-foreground mt-2 max-w-xs">
        This customer is not part of your shop. Switch to a shop where the
        customer has an order to view their profile.
      </p>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-20 ml-auto" />
      </div>
      <Separator />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
