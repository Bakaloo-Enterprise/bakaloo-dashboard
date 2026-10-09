"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useBotAreas, useBotKnowledgeMutations, useBotProductWords, useBotWaitingList } from "@/hooks/useWhatsappCrm"
import type { BotArea } from "@/types/whatsapp-crm.types"

const splitList = (t: string) => t.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean)

function AreaRow({ a }: { a: BotArea }) {
  const m = useBotKnowledgeMutations()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(a.name)
  const [nameGu, setNameGu] = useState(a.name_gu ?? "")
  const [aliases, setAliases] = useState(a.aliases.join(", "))
  return (
    <li className="p-3">
      <div className="flex items-center gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="text-sm font-medium">{a.name}</span>
          {a.name_gu && <span className="ml-2 text-xs text-muted-foreground">{a.name_gu}</span>}
          <Badge variant={a.is_serviceable ? "default" : "outline"} className="ml-2 text-[10px]">{a.is_serviceable ? "We deliver" : "Not yet"}</Badge>
        </button>
        <Switch checked={a.is_serviceable} onCheckedChange={(v) => m.updateArea.mutate({ id: a.id, input: { isServiceable: v } })} aria-label={`We deliver to ${a.name}`} />
        <Button variant="ghost" size="icon" aria-label={`Delete ${a.name}`} onClick={() => { if (window.confirm(`Delete the area “${a.name}”?`)) m.deleteArea.mutate(a.id) }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><Label htmlFor={`an-${a.id}`}>Name</Label><Input id={`an-${a.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
          <div><Label htmlFor={`ag-${a.id}`}>Name in Gujarati</Label><Input id={`ag-${a.id}`} value={nameGu} onChange={(e) => setNameGu(e.target.value)} maxLength={80} /></div>
          <div className="sm:col-span-2">
            <Label htmlFor={`aa-${a.id}`}>Other spellings customers use (comma separated)</Label>
            <Input id={`aa-${a.id}`} value={aliases} onChange={(e) => setAliases(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" disabled={!name.trim() || m.updateArea.isPending} onClick={() => m.updateArea.mutate({ id: a.id, input: { name: name.trim(), nameGu: nameGu.trim() || null, aliases: splitList(aliases) } })}>Save area</Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Delivery areas, the waiting list, and the product words the bot understands. */
export function BotKnowledgePanel() {
  const areas = useBotAreas()
  const waiting = useBotWaitingList()
  const words = useBotProductWords()
  const m = useBotKnowledgeMutations()
  const [name, setName] = useState("")
  const [nameGu, setNameGu] = useState("")
  const [aliases, setAliases] = useState("")
  const [serviceable, setServiceable] = useState(false)
  const [alias, setAlias] = useState("")
  const [term, setTerm] = useState("")
  const list = areas.data ?? []
  const wl = (waiting.data ?? []).filter((r) => !r.is_serviceable)

  return (
    <div className="space-y-5">
      <section aria-label="Delivery areas">
        <h3 className="mb-1 text-sm font-semibold">Delivery areas <span className="font-normal text-muted-foreground">({list.filter((a) => a.is_serviceable).length} served)</span></h3>
        <p className="mb-2 text-xs text-muted-foreground">The bot tells customers where you deliver and understands the spellings below. Switch an area on when you start delivering there.</p>
        <ul className="divide-y rounded-lg border bg-card">
          {areas.isLoading && <li className="p-3"><Skeleton className="h-10 w-full" /></li>}
          {list.map((a) => <AreaRow key={a.id} a={a} />)}
        </ul>
        <form
          className="mt-2 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_1fr_1.5fr_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            m.createArea.mutate({ name: name.trim(), nameGu: nameGu.trim() || null, aliases: splitList(aliases), isServiceable: serviceable }, { onSuccess: () => { setName(""); setNameGu(""); setAliases(""); setServiceable(false) } })
          }}
        >
          <div><Label htmlFor="new-area">New area</Label><Input id="new-area" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Yogi Chowk" /></div>
          <div><Label htmlFor="new-area-gu">In Gujarati</Label><Input id="new-area-gu" value={nameGu} onChange={(e) => setNameGu(e.target.value)} maxLength={80} /></div>
          <div><Label htmlFor="new-area-al">Spellings (comma separated)</Label><Input id="new-area-al" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="yogichowk, yogi chok" /></div>
          <label className="flex items-center gap-2 pb-2 text-xs"><Switch checked={serviceable} onCheckedChange={setServiceable} aria-label="We deliver here" /> We deliver</label>
          <Button type="submit" disabled={!name.trim() || m.createArea.isPending}><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </form>
      </section>

      <section aria-label="Customers waiting for their area">
        <h3 className="mb-1 text-sm font-semibold">Customers waiting for their area</h3>
        <p className="mb-2 text-xs text-muted-foreground">People who named a place you do not deliver to yet (or one the bot did not recognise). Useful for deciding where to expand and where ads are wasted.</p>
        <ul className="divide-y rounded-lg border bg-card text-sm">
          {wl.length === 0 && <li className="p-3 text-xs text-muted-foreground">Nobody yet.</li>}
          {wl.map((r) => (
            <li key={`${r.area_id ?? "t"}-${r.area}`} className="flex items-center justify-between px-3 py-2">
              <span>{r.area}{r.area_id === null && <span className="ml-2 text-xs text-muted-foreground">(typed by the customer — add it above if it is a real area)</span>}</span>
              <span className="text-xs text-muted-foreground">{r.people} {r.people === 1 ? "person" : "people"} · {r.opted_in} said START</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Product words">
        <h3 className="mb-1 text-sm font-semibold">Product words <span className="font-normal text-muted-foreground">({(words.data ?? []).length})</span></h3>
        <p className="mb-2 text-xs text-muted-foreground">What customers type (Gujarati, English letters, English) → the English name in your catalog. The bot only says “yes, we have it” for items that are in stock right now.</p>
        <form
          className="mb-2 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (alias.trim() && term.trim()) m.addWord.mutate({ alias: alias.trim(), searchTerm: term.trim() }, { onSuccess: () => { setAlias(""); setTerm("") } })
          }}
        >
          <div><Label htmlFor="pw-alias">Customer types</Label><Input id="pw-alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. libu or લીંબુ" maxLength={60} /></div>
          <div><Label htmlFor="pw-term">Catalog name contains</Label><Input id="pw-term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. lemon" maxLength={60} /></div>
          <Button type="submit" disabled={!alias.trim() || !term.trim() || m.addWord.isPending}><Plus className="mr-1 h-4 w-4" /> Add word</Button>
        </form>
        <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-lg border bg-card p-3">
          {(words.data ?? []).map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
              {w.alias} <span className="text-muted-foreground">→ {w.search_term}</span>
              <button type="button" aria-label={`Remove ${w.alias}`} onClick={() => m.deleteWord.mutate(w.id)} className="text-muted-foreground hover:text-red-600">×</button>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
