"use client"

import { useEffect, useRef, useState } from "react"
import { Bookmark, SlidersHorizontal, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { CrmAgent, InboxCriteria, WaLabel, WaSavedFilter } from "@/types/whatsapp-crm.types"
import { META_TAG_NAMES, QUICK_FILTERS, activeCount, describeCriteria, matchingQuickFilter, normalizeCriteria, sameCriteria } from "../inbox-filters"

function Chip({ active, children, onClick, title, onRemove }: { active: boolean; children: React.ReactNode; onClick: () => void; title?: string; onRemove?: () => void }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full text-[14px] leading-5 transition-colors",
        active ? "bg-[var(--wa-chip-active-bg)] text-[var(--wa-chip-active-text)]" : "bg-[var(--wa-chip-bg)] text-[var(--wa-secondary)] hover:bg-[var(--wa-selected)]",
      )}
    >
      <button type="button" role="tab" aria-selected={active} title={title} onClick={onClick} className={cn("whitespace-nowrap py-1.5 pl-3", onRemove ? "pr-1" : "pr-3", active && "font-medium")}>
        {children}
      </button>
      {onRemove && (
        <button type="button" aria-label="Delete this saved filter" onClick={onRemove} className="mr-1.5 rounded-full p-0.5 opacity-70 hover:opacity-100">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

function Seg<T extends string | number | boolean | undefined>({ value, options, onChange, label }: { value: T; options: Array<{ label: string; value: T }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs transition-colors",
            value === o.value ? "bg-[var(--wa-chip-active-bg)] font-medium text-[var(--wa-chip-active-text)]" : "bg-[var(--wa-chip-bg)] text-[var(--wa-secondary)] hover:bg-[var(--wa-selected)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--wa-secondary)]">{title}</p>
      {children}
    </div>
  )
}

interface Props {
  criteria: InboxCriteria
  onChange: (c: InboxCriteria) => void
  labels: WaLabel[]
  agents: CrmAgent[]
  saved: WaSavedFilter[]
  onSave: (name: string, c: InboxCriteria) => Promise<unknown> | void
  onDeleteSaved: (id: string) => void
  /** Only the filter button (placed in the list header) or only the chips row. */
  part: "chips" | "button"
  open: boolean
  onOpenChange: (o: boolean) => void
}

export function WaFilterBar({ criteria, onChange, labels, agents, saved, onSave, onDeleteSaved, part, open, onOpenChange }: Props) {
  const [name, setName] = useState("")
  const quick = matchingQuickFilter(criteria)
  const savedActive = saved.find((s) => sameCriteria(s.criteria, criteria))
  const n = activeCount(criteria)
  const set = (patch: Partial<InboxCriteria>) => onChange(normalizeCriteria({ ...criteria, ...patch }))

  const metaLabels = META_TAG_NAMES.map((nm) => labels.find((l) => l.name === nm)).filter((l): l is WaLabel => Boolean(l))
  const otherLabels = labels.filter((l) => !(META_TAG_NAMES as readonly string[]).includes(l.name))
  const toggleLabel = (id: string) => {
    const cur = criteria.labelIds ?? []
    set({ labelIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }
  const canSave = n > 0 && !quick && !savedActive
  // A saved/custom chip can sit past the right edge of the row — bring the active one into view.
  const row = useRef<HTMLDivElement>(null)
  const activeKey = quick?.key ?? savedActive?.id ?? (n > 0 ? "custom" : "")
  useEffect(() => {
    row.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ inline: "nearest", block: "nearest" })
  }, [activeKey])

  if (part === "chips")
    return (
      <div ref={row} role="tablist" aria-label="Filter chats" className="wa-scroll flex gap-2 overflow-x-auto px-3 pb-2.5 pt-1">
        {QUICK_FILTERS.map((q) => (
          <Chip key={q.key} active={quick?.key === q.key} onClick={() => onChange(q.criteria)}>
            {q.label}
          </Chip>
        ))}
        {saved.map((s) => (
          <Chip key={s.id} active={savedActive?.id === s.id} title={describeCriteria(s.criteria, labels, (id) => agents.find((a) => a.id === id)?.name ?? undefined)} onClick={() => onChange(s.criteria)} onRemove={() => onDeleteSaved(s.id)}>
            <Bookmark className="-mt-0.5 mr-1 inline h-3 w-3" aria-hidden />
            {s.name}
          </Chip>
        ))}
        {!quick && !savedActive && n > 0 && (
          <Chip active onClick={() => onOpenChange(true)} title="Custom filter">
            Custom · {n}
          </Chip>
        )}
      </div>
    )

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Filter chats"
          aria-label={n > 0 ? `Filters (${n} on)` : "Filters"}
          className={cn("relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--wa-secondary)] transition-colors hover:bg-black/5 dark:hover:bg-white/10", n > 0 && "text-[var(--wa-green)]")}
        >
          <SlidersHorizontal className="h-5 w-5" />
          {n > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--wa-unread)] px-1 text-[10px] font-bold text-white">{n}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="wa-app wa-scroll max-h-[min(78vh,640px)] w-[340px] space-y-4 overflow-y-auto border-[var(--wa-border)] bg-[var(--wa-panel)] p-4 text-[var(--wa-text)]">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">Filter chats</h3>
          <button type="button" onClick={() => onChange({})} disabled={n === 0} className="text-xs font-medium text-[var(--wa-green-dark)] disabled:opacity-40">
            Clear all
          </button>
        </div>

        <Group title="Status">
          <Seg label="Status" value={criteria.status} onChange={(v) => set({ status: v })} options={[{ label: "Any", value: undefined }, { label: "Open", value: "OPEN" }, { label: "Pending", value: "PENDING" }, { label: "Resolved", value: "RESOLVED" }]} />
        </Group>

        <Group title="Owner">
          <select
            aria-label="Owner"
            value={criteria.assignedTo ?? ""}
            onChange={(e) => set({ assignedTo: e.target.value || undefined })}
            className="h-9 w-full rounded-lg border border-[var(--wa-border)] bg-[var(--wa-input-bg)] px-2 text-sm"
          >
            <option value="">Anyone</option>
            <option value="me">Mine</option>
            <option value="unassigned">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.email}
              </option>
            ))}
          </select>
        </Group>

        <Group title="Messages">
          <div className="flex flex-wrap gap-1">
            <Seg label="Unread" value={criteria.unread ? true : undefined} onChange={(v) => set({ unread: v === true })} options={[{ label: "Read + unread", value: undefined }, { label: "Unread only", value: true }]} />
          </div>
          <Seg label="Needs a person" value={criteria.needsPerson ? true : undefined} onChange={(v) => set({ needsPerson: v === true })} options={[{ label: "Any chat", value: undefined }, { label: "Needs a person", value: true }]} />
        </Group>

        <Group title="Customer">
          <Seg label="Customer type" value={criteria.lead} onChange={(v) => set({ lead: v })} options={[{ label: "Anyone", value: undefined }, { label: "New leads", value: true }, { label: "Existing customers", value: false }]} />
        </Group>

        <Group title="24-hour reply window">
          <Seg label="Reply window" value={criteria.windowOpen} onChange={(v) => set({ windowOpen: v })} options={[{ label: "Any", value: undefined }, { label: "Can reply now", value: true }, { label: "Closed", value: false }]} />
        </Group>

        <Group title="Last message">
          <Seg label="Period" value={criteria.days} onChange={(v) => set({ days: v })} options={[{ label: "Any time", value: undefined }, { label: "24 hours", value: 1 }, { label: "7 days", value: 7 }, { label: "30 days", value: 30 }]} />
        </Group>

        <Group title="Where the chat came from">
          <Seg label="Source" value={criteria.source} onChange={(v) => set({ source: v })} options={[{ label: "Anywhere", value: undefined }, { label: "Meta ads", value: "META_AD" }, { label: "Organic", value: "ORGANIC" }]} />
          {metaLabels.length > 0 && (
            <div className="space-y-1 pt-1" role="group" aria-label="Meta ad tags">
              <p className="text-xs text-[var(--wa-secondary)]">Meta ad tags (added automatically)</p>
              {metaLabels.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={Boolean(criteria.labelIds?.includes(l.id))} onCheckedChange={() => toggleLabel(l.id)} aria-label={l.name} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </label>
              ))}
            </div>
          )}
        </Group>

        {otherLabels.length > 0 && (
          <Group title="Labels (any of)">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1" role="group" aria-label="Labels">
              {otherLabels.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={Boolean(criteria.labelIds?.includes(l.id))} onCheckedChange={() => toggleLabel(l.id)} aria-label={l.name} />
                  <span className="truncate">{l.name}</span>
                </label>
              ))}
            </div>
          </Group>
        )}

        <div className="space-y-2 border-t border-[var(--wa-border)] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--wa-secondary)]">Save this filter</p>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name, e.g. Hot Instagram leads" aria-label="Name for this filter" className="h-9 bg-[var(--wa-input-bg)]" />
            <button
              type="button"
              disabled={!name.trim() || n === 0}
              onClick={async () => {
                await onSave(name.trim(), criteria)
                setName("")
              }}
              className="shrink-0 rounded-lg bg-[var(--wa-green)] px-3 text-sm font-medium text-white disabled:opacity-40"
            >
              Save
            </button>
          </div>
          {!canSave && n > 0 && (quick || savedActive) && <p className="text-xs text-[var(--wa-secondary)]">This is already a ready-made filter. Change something to save your own.</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
