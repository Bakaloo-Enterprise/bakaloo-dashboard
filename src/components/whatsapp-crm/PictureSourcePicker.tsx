"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useProducts } from "@/hooks/useProducts"
import { cn } from "@/lib/utils"
import type { PictureSource } from "@/types/whatsapp-crm.types"
import { ImageUploadField } from "./ImageUploadField"

type Mode = PictureSource["mode"]

const OPTIONS: Array<{ mode: Mode; title: string; hint: string; cartOnly?: boolean }> = [
  { mode: "CART_PRODUCT", title: "The product the customer left in their cart", hint: "Every customer gets a picture of their own item. Nothing to choose.", cartOnly: true },
  { mode: "OFFER_PRODUCTS", title: "A product that is on offer today", hint: "We pick a discounted product by ourselves each time. Always fresh." },
  { mode: "PRODUCTS", title: "Products I choose", hint: "Pick some products. Each message shows one of them, picked at random." },
  { mode: "IMAGES", title: "My own pictures or banners", hint: "Upload one picture, or many. With many, each message gets a different one. Good for festivals like Navratri." },
]

interface Props {
  value: PictureSource | null
  onChange: (v: PictureSource | null) => void
  /** cart reminders can use the customer's own cart item */
  allowCart?: boolean
}

/** "Which picture should we send?" — the template is approved once; the picture is chosen again for every message. */
export function PictureSourcePicker({ value, onChange, allowCart = false }: Props) {
  const mode = value?.mode ?? null
  const options = OPTIONS.filter((o) => allowCart || !o.cartOnly)

  const choose = (m: Mode) => {
    if (m === mode) return
    const keepFallback = value?.fallbackUrl ? { fallbackUrl: value.fallbackUrl } : {}
    if (m === "CART_PRODUCT") onChange({ mode: m, pick: "TOP", ...keepFallback })
    else if (m === "OFFER_PRODUCTS") onChange({ mode: m, ...keepFallback })
    else if (m === "PRODUCTS") onChange({ mode: m, productIds: [], ...keepFallback })
    else onChange({ mode: "IMAGES", urls: [], ...keepFallback })
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Which picture should we send?</legend>
      <p className="text-xs text-muted-foreground">Meta checks this template once with a sample picture. After that you can send any picture you like. It does not need to be approved again.</p>
      <div role="radiogroup" aria-label="Picture source" className="grid gap-2">
        {options.map((o) => (
          <button
            key={o.mode}
            type="button"
            role="radio"
            aria-checked={mode === o.mode}
            onClick={() => choose(o.mode)}
            className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-muted/50", mode === o.mode && "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30")}
          >
            <span className="block text-sm font-medium">{o.title}</span>
            <span className="block text-xs text-muted-foreground">{o.hint}</span>
          </button>
        ))}
      </div>

      {value?.mode === "CART_PRODUCT" && (
        <div className="flex gap-2" role="radiogroup" aria-label="Which cart item">
          {([["TOP", "The most expensive item"], ["RANDOM", "A random item"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={value.pick === k} onClick={() => onChange({ ...value, pick: k })}
              className={cn("rounded-full border px-3 py-1 text-xs", value.pick === k ? "border-emerald-600 bg-emerald-50 font-medium" : "hover:bg-muted/50")}>{label}</button>
          ))}
        </div>
      )}

      {value?.mode === "PRODUCTS" && <ProductChooser ids={value.productIds ?? []} onChange={(productIds) => onChange({ ...value, productIds })} />}
      {value?.mode === "IMAGES" && <ImageList urls={value.urls ?? []} onChange={(urls) => onChange({ ...value, urls })} />}

      {value && (
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-medium">Backup picture (recommended)</p>
          <p className="mb-2 text-xs text-muted-foreground">If we cannot find a picture for someone, we send this one instead of skipping them.</p>
          {value.fallbackUrl ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value.fallbackUrl} alt="Backup" className="h-12 w-12 rounded object-cover" />
              <button type="button" className="text-xs text-red-600 underline" onClick={() => onChange({ ...value, fallbackUrl: undefined })}>Remove</button>
            </div>
          ) : (
            <ImageUploadField label="Upload backup picture" onUploaded={(u) => onChange({ ...value, fallbackUrl: u })} />
          )}
        </div>
      )}
    </fieldset>
  )
}

function ImageList({ urls, onChange }: { urls: string[]; onChange: (u: string[]) => void }) {
  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Chosen pictures">
          {urls.map((u) => (
            <li key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="Chosen picture" className="h-16 w-16 rounded-md object-cover" />
              <button type="button" aria-label="Remove picture" onClick={() => onChange(urls.filter((x) => x !== u))} className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 shadow"><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
      {urls.length < 20 && <ImageUploadField label={urls.length ? "Add another picture" : "Upload a picture"} onUploaded={(u) => onChange([...urls, u])} />}
      <p className="text-xs text-muted-foreground">{urls.length === 0 ? "Add at least one picture." : urls.length === 1 ? "Everyone gets this picture. Add more and we will rotate them." : `${urls.length} pictures. Each message gets one of them at random.`}</p>
    </div>
  )
}

function ProductChooser({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("")
  const results = useProducts({ search: search || undefined, limit: 8, status: "active" })
  const list = results.data?.products ?? []
  const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 50 ? ids : [...ids, id])
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your products" className="pl-8" aria-label="Search products" />
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto" aria-label="Products">
        {list.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-muted/50">
              <input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} />
              {p.thumbnail_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.thumbnail_url} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="h-9 w-9 rounded bg-muted" />}
              <span className="text-sm">{p.name}</span>
            </label>
          </li>
        ))}
        {!results.isLoading && list.length === 0 && <li className="p-2 text-xs text-muted-foreground">No products found.</li>}
      </ul>
      <p className="text-xs text-muted-foreground">{ids.length === 0 ? "Choose at least one product." : `${ids.length} chosen. Each message shows one at random.`}</p>
    </div>
  )
}

/** Is the choice complete enough to save? */
export function pictureOk(p: PictureSource | null): boolean {
  if (!p) return false
  if (p.mode === "CART_PRODUCT" || p.mode === "OFFER_PRODUCTS") return true
  if (p.mode === "PRODUCTS") return p.productIds.length > 0
  return p.urls.length > 0
}
