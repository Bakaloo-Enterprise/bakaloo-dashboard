"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LabelChip } from "@/components/whatsapp-crm/LabelChip"
import { useCrmMe, useLabelMutations, useLabels } from "@/hooks/useWhatsappCrm"
import type { WaLabel } from "@/types/whatsapp-crm.types"

const DEFAULT_COLOR = "#2563EB"

export default function LabelsPage() {
  const me = useCrmMe()
  const labels = useLabels()
  const { create, update, remove } = useLabelMutations()
  const [editing, setEditing] = useState<WaLabel | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState(DEFAULT_COLOR)

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!me.can("crm.labels.manage")) return <Forbidden />

  const reset = () => {
    setEditing(null)
    setName("")
    setColor(DEFAULT_COLOR)
  }
  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (editing) update.mutate({ id: editing.id, input: { name: trimmed, color } }, { onSuccess: reset })
    else create.mutate({ name: trimmed, color }, { onSuccess: reset })
  }

  return (
    <div className="space-y-4">
      <PageHeader title="WhatsApp Labels" subtitle="Tags agents add to customers, e.g. VIP, B2B, Complaint" />

      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="grow sm:max-w-xs">
          <label htmlFor="label-name" className="mb-1 block text-xs font-medium">
            {editing ? "Rename label" : "New label"}
          </label>
          <Input id="label-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Wholesale" />
        </div>
        <div>
          <label htmlFor="label-color" className="mb-1 block text-xs font-medium">
            Colour
          </label>
          <input id="label-color" type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-9 w-14 cursor-pointer rounded border bg-transparent p-1" />
        </div>
        <Button type="submit" disabled={!name.trim() || create.isPending || update.isPending}>
          {editing ? "Save" : (<><Plus className="mr-1 h-4 w-4" /> Add label</>)}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        )}
        {name.trim() && <LabelChip label={{ id: "preview", name: name.trim(), color }} />}
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead className="text-right">Customers</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(labels.data ?? []).map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <LabelChip label={l} />
                </TableCell>
                <TableCell className="text-right">{l.customer_count}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${l.name}`}
                    onClick={() => {
                      setEditing(l)
                      setName(l.name)
                      setColor(l.color.toUpperCase())
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${l.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete “${l.name}”? It will be removed from ${l.customer_count} customer(s).`)) remove.mutate(l.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
