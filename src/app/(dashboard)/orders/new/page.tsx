"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  ShoppingCart,
  MapPin,
  CreditCard,
  Tag,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/PageHeader"
import { CustomerPicker, type OrderKind } from "@/components/orders/CustomerPicker"
import { B2BPaymentPanel, b2bPaymentProblem, type B2BPayment } from "@/components/orders/B2BPaymentPanel"
import { useProducts } from "@/hooks/useProducts"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { useDebounce } from "@/hooks/useDebounce"
import { useCreateManualOrder } from "@/hooks/useUploads"
import { formatINR } from "@/lib/utils"
import { usePermissions } from "@/hooks/usePermissions"
import type { StaffCustomer } from "@/services/uploads.service"
import type { Product } from "@/types/product.types"
import type { DeliveryAddress } from "@/types/order.types"

interface CartItem {
  product: Product
  quantity: number
  /** B2B only: the price agreed with the customer for one unit ("" = the standard business price). */
  price?: string
}

const STEPS = [
  { label: "Customer", icon: User },
  { label: "Products", icon: ShoppingCart },
  { label: "Address", icon: MapPin },
  { label: "Payment", icon: CreditCard },
  { label: "Coupon", icon: Tag },
  { label: "Confirm", icon: CheckCircle2 },
]

export default function NewOrderPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const { can } = usePermissions()
  const canManageOrders = can("orders.manage")

  useEffect(() => {
    if (!canManageOrders) {
      router.replace("/orders")
    }
  }, [canManageOrders, router])

  // Step 1: Customer
  const [selectedCustomer, setSelectedCustomer] = useState<StaffCustomer | null>(null)
  // Home customer (B2C) or a business buying on credit (B2B).
  const [orderType, setOrderType] = useState<OrderKind>("B2C")
  const isB2B = orderType === "B2B"
  const [b2b, setB2b] = useState<B2BPayment>({ dueDate: "", advance: "", method: "CASH" })

  // Step 2: Products
  const [productSearch, setProductSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const debouncedProductSearch = useDebounce(productSearch, 400)

  // Step 3: Address
  const [address, setAddress] = useState<DeliveryAddress>({
    address_line: "",
    city: "",
    state: "",
    pincode: "",
  })

  // Step 4: Payment
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "MANUAL">("MANUAL")
  // Which store delivers it (its stock is used) and whether the money is already in hand.
  const [shopId, setShopId] = useState("")
  const [paymentReceived, setPaymentReceived] = useState(false)
  const shops = useActiveShopsForSwitcher()

  // Step 5: Coupon
  const [couponCode, setCouponCode] = useState("")

  // Queries
  const { data: productsData } = useProducts({
    search: debouncedProductSearch || undefined,
    limit: 10,
  })

  const createOrder = useCreateManualOrder()

  const products = productsData?.products ?? []

  // What one unit costs: a business pays its agreed price, else the wholesale price, else the list price; a home customer the sale price.
  // (The store's own price can differ a little; the saved order uses the store's price and shows the exact total.)
  const unitPriceOf = (item: CartItem) => {
    if (isB2B) {
      const agreed = item.price !== undefined && item.price !== "" ? Number(item.price) : NaN
      return Number.isFinite(agreed) ? agreed : item.product.wholesale_price ?? item.product.price ?? 0
    }
    return item.product.sale_price ?? item.product.price ?? 0
  }
  const cartTotal = cart.reduce((sum, item) => sum + unitPriceOf(item) * item.quantity, 0)
  const setLinePrice = (productId: string, price: string) => setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, price: price.replace(/[^\d.]/g, "") } : i)))

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }, [])

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    )
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }, [])

  if (!canManageOrders) return null

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedCustomer
      case 1: return cart.length > 0
      case 2: return !!address.city && !!address.pincode
      case 3: return !isB2B || !b2bPaymentProblem(b2b, cartTotal)
      case 4: return true
      case 5: return true
      default: return false
    }
  }

  const handlePlaceOrder = () => {
    if (!selectedCustomer) return
    createOrder.mutate(
      {
        userId: selectedCustomer.id,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          ...(isB2B && i.price ? { unitPrice: Number(i.price) } : {}),
        })),
        orderType,
        ...(isB2B
          ? {
              dueDate: b2b.dueDate || undefined,
              advance: Number(b2b.advance) > 0 ? { amount: Number(b2b.advance), method: b2b.method } : undefined,
            }
          : { paymentMethod, paymentReceived: paymentMethod === "MANUAL" ? paymentReceived : undefined }),
        shopId: shopId || undefined,
        deliveryAddress: address as unknown as Record<string, unknown>,
        couponCode: !isB2B ? couponCode || undefined : undefined,
      },
      {
        onSuccess: () => {
          router.push(isB2B ? "/b2b/orders" : "/orders")
        },
      }
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Create Order" subtitle="Place an order for a customer" />
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = i === step
          const isDone = i < step
          return (
            <div key={s.label} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full ${isActive
                    ? "bg-brand-50 text-brand-600 border border-brand-200"
                    : isDone
                      ? "bg-green-50 text-green-600 cursor-pointer hover:bg-green-100"
                      : "bg-muted text-muted-foreground"
                  }`}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Home customer or business, then find them — or add them if they are not on the platform yet */}
          {step === 0 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="text-base">Who is the order for?</CardTitle>
              </CardHeader>
              <CustomerPicker orderType={orderType} onOrderType={setOrderType} selected={selectedCustomer} onSelect={setSelectedCustomer} />
            </div>
          )}

          {/* Step 2: Add Products */}
          {step === 1 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="text-base">Add Products</CardTitle>
              </CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  aria-label="Search products"
                  placeholder="Search products..."
                  className="pl-9"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>

              {/* Product search results */}
              {productSearch && products.length > 0 && (
                <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-muted text-left text-sm border-b last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatINR(p.sale_price ?? p.price ?? 0)} · All stores: {p.stock_quantity}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-brand-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Cart */}
              {cart.length > 0 && (
                <>
                  <Separator />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.product.id}>
                          <TableCell className="text-sm font-medium">
                            {item.product.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.product.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.product.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {isB2B ? (
                              <Input
                                aria-label={`Agreed price for ${item.product.name}`}
                                className="ml-auto h-8 w-24 text-right"
                                inputMode="decimal"
                                placeholder={String(item.product.wholesale_price ?? item.product.price ?? 0)}
                                value={item.price ?? ""}
                                onChange={(e) => setLinePrice(item.product.id, e.target.value)}
                              />
                            ) : (
                              formatINR(unitPriceOf(item))
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {formatINR(unitPriceOf(item) * item.quantity)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm text-muted-foreground">
                      {cart.reduce((s, i) => s + i.quantity, 0)} items
                    </span>
                    <span className="text-lg font-bold">{formatINR(cartTotal)}</span>
                  </div>
                  {isB2B && <p className="text-xs text-muted-foreground">Business prices: type the price you agreed, or leave it empty for the standard business price.</p>}
                </>
              )}

              {cart.length === 0 && !productSearch && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Search and add products to the order
                </p>
              )}
            </div>
          )}

          {/* Step 3: Delivery Address */}
          {step === 2 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="text-base">Delivery Address</CardTitle>
              </CardHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Address Line</Label>
                  <Input
                    placeholder="House / Flat / Street"
                    value={address.address_line ?? ""}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, address_line: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    placeholder="City"
                    value={address.city}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, city: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    placeholder="State"
                    value={address.state ?? ""}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, state: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Pincode *</Label>
                  <Input
                    placeholder="6-digit pincode"
                    value={address.pincode}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, pincode: e.target.value }))
                    }
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Payment Method */}
          {step === 3 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="text-base">Payment Method</CardTitle>
              </CardHeader>
              {isB2B ? (
                <B2BPaymentPanel value={b2b} onChange={setB2b} total={cartTotal} />
              ) : (
                <>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as "COD" | "MANUAL")}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-muted cursor-pointer">
                  <RadioGroupItem value="COD" id="cod" />
                  <Label htmlFor="cod" className="cursor-pointer flex-1">
                    <p className="font-medium">Cash on Delivery</p>
                    <p className="text-xs text-muted-foreground">
                      Customer pays when order is delivered
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-muted cursor-pointer">
                  <RadioGroupItem value="MANUAL" id="manual" />
                  <Label htmlFor="manual" className="cursor-pointer flex-1">
                    <p className="font-medium">Manual Payment</p>
                    <p className="text-xs text-muted-foreground">
                      Staff collect the money themselves (cash / UPI / card)
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              {paymentMethod === "MANUAL" && (
                <label className="flex items-center gap-3 rounded-lg border-2 border-green-300 bg-green-50 p-4 cursor-pointer">
                  <input type="checkbox" className="h-5 w-5" checked={paymentReceived} onChange={(e) => setPaymentReceived(e.target.checked)} />
                  <span>
                    <span className="block font-medium">Money already received</span>
                    <span className="block text-xs text-muted-foreground">Leave this off if you have not been paid yet. You can mark it paid later from the order.</span>
                  </span>
                </label>
              )}

                </>
              )}

              <div className="space-y-1.5 rounded-lg border p-4">
                <Label htmlFor="shop-pick" className="font-medium">Which store delivers this order?</Label>
                <select id="shop-pick" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={shopId} onChange={(e) => setShopId(e.target.value)}>
                  <option value="">Choose for me (only if one store has everything)</option>
                  {(shops.data?.items ?? []).map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">The stock is taken from this store, exactly like an app order.</p>
              </div>
            </div>
          )}

          {/* Step 5: Coupon */}
          {step === 4 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="text-base">Apply Coupon (Optional)</CardTitle>
              </CardHeader>
              {isB2B && <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900">Coupons are not used for business orders. You can skip this step.</p>}
              <div className={isB2B ? "hidden" : "flex items-center gap-2"}>
                <Input
                  placeholder="Enter coupon code..."
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1"
                />
                {couponCode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCouponCode("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to skip. Coupon validity will be checked server-side.
              </p>
            </div>
          )}

          {/* Step 6: Confirm */}
          {step === 5 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>

              {/* Customer */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {selectedCustomer?.businessName || selectedCustomer?.name || "Unnamed"}
                    {selectedCustomer?.notOnApp && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Not on the app yet</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCustomer?.phone}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {item.product.name} × {item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatINR(unitPriceOf(item) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold">{formatINR(cartTotal)}</span>
              </div>

              {/* Address */}
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Delivery Address
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  {address.address_line && `${address.address_line}, `}
                  {address.city}
                  {address.state && `, ${address.state}`}
                  {address.pincode && ` — ${address.pincode}`}
                </p>
              </div>

              {/* Payment + Coupon */}
              <div className="flex items-center gap-4 text-sm">
                <Badge variant={isB2B ? "default" : "outline"}>
                  {isB2B
                    ? `Business order — pay later${b2b.dueDate ? ` by ${b2b.dueDate}` : ""}${Number(b2b.advance) > 0 ? ` · ${formatINR(Number(b2b.advance))} ${b2b.method === "UPI" ? "UPI" : "cash"} received` : ""}`
                    : paymentMethod === "COD" ? "Cash on Delivery" : paymentReceived ? "Manual Payment — received" : "Manual Payment — not received yet"}
                </Badge>
                {couponCode && (
                  <Badge variant="secondary">
                    <Tag className="h-3 w-3 mr-1" />
                    {couponCode}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>

        {step < 5 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button
            onClick={handlePlaceOrder}
            disabled={createOrder.isPending}
            className="bg-brand-500 hover:bg-brand-600"
          >
            {createOrder.isPending ? "Placing..." : "Place Order"}
            <Check className="h-4 w-4 ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
