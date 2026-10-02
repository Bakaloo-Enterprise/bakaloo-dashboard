"use client"

import { useEffect, useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCoupons } from "@/hooks/useCoupons"
import { useLabels, useTemplates, useWorkflowCatalog } from "@/hooks/useWhatsappCrm"
import type { ConditionOp, Workflow, WorkflowAction, WorkflowInput, WorkflowTrigger } from "@/types/whatsapp-crm.types"
import { cleanConditions, FIELD_LABEL, OP_LABEL, ORDER_STATUS_OPTIONS, TEXT_FIELDS, tokenHint, TRIGGER_LABEL } from "./campaign-helpers"
import { sendVariables } from "./template-helpers"

interface Props {
  open: boolean
  workflow: Workflow | null
  saving: boolean
  onClose: () => void
  onSave: (input: WorkflowInput) => void
}

const DELAYS = [5, 10, 15, 30, 60, 120]
const TEXT_OPS: ConditionOp[] = ["eq", "neq"]
const NUM_OPS: ConditionOp[] = ["gt", "gte", "lt", "lte", "eq", "neq"]

interface Row { field: string; op: ConditionOp; value: string }

/** WHEN something happens · IF it matches · DO send a template (and optionally label the customer). */
export function WorkflowDialog({ open, workflow, saving, onClose, onSave }: Props) {
  const [name, setName] = useState("")
  const [trigger, setTrigger] = useState<WorkflowTrigger>("CART_ABANDONED")
  const [delay, setDelay] = useState(5)
  const [status, setStatus] = useState("PACKED")
  const [rows, setRows] = useState<Row[]>([])
  const [templateId, setTemplateId] = useState("")
  const [values, setValues] = useState<Record<string, string>>({})
  const [couponId, setCouponId] = useState("")
  const [labelId, setLabelId] = useState("")

  const catalog = useWorkflowCatalog(open)
  const templates = useTemplates({ status: "APPROVED" }, open)
  const labels = useLabels()
  const coupons = useCoupons({ limit: 100, isActive: true }, { shopScoped: false })

  useEffect(() => {
    if (!open) return
    const send = workflow?.actions.find((a): a is Extract<WorkflowAction, { type: "SEND_TEMPLATE" }> => a.type === "SEND_TEMPLATE")
    const label = workflow?.actions.find((a): a is Extract<WorkflowAction, { type: "ADD_LABEL" }> => a.type === "ADD_LABEL")
    setName(workflow?.name ?? "")
    setTrigger(workflow?.trigger_type ?? "CART_ABANDONED")
    setDelay(workflow?.trigger_config.delay_minutes ?? 5)
    setStatus(workflow?.trigger_config.status ?? "PACKED")
    setRows((workflow?.conditions ?? []).map((c) => ({ field: c.field, op: c.op, value: String(c.value) })))
    setTemplateId(send?.templateId ?? "")
    setValues(send?.values ?? {})
    setCouponId(send?.couponId ?? "")
    setLabelId(label?.labelId ?? "")
  }, [open, workflow])

  const info = catalog.data?.triggers[trigger]
  const tpl = (templates.data?.templates ?? []).find((t) => t.id === templateId)
  const tokens = info?.tokens ?? []
  const publicCoupons = (coupons.data?.data ?? []).filter((c) => c.isActive && c.targetType === "ALL")
  const usesCoupon = trigger === "CART_ABANDONED" && Boolean(couponId)
  // Variables the system fills by itself (same name as a token) need no typing. coupon_code is only
  // filled automatically when a coupon is attached.
  const autoFilled = tokens.filter((t) => t !== "coupon_code" || usesCoupon)
  const needTyped = tpl ? sendVariables(tpl).filter((v) => !autoFilled.includes(String(v.key ?? v.name))) : []
  const missing = needTyped.some((v) => !values[String(v.key ?? v.name)]?.trim())
  const editing = Boolean(workflow)
  const valid = name.trim() && templateId && !missing && (trigger !== "ORDER_STATUS" || status) && rows.every((r) => !r.field || r.value.trim() !== "")

  const submit = () => {
    const spec: Record<string, string> = {}
    for (const v of needTyped) spec[String(v.key ?? v.name)] = values[String(v.key ?? v.name)] ?? ""
    const actions: WorkflowAction[] = [{ type: "SEND_TEMPLATE", templateId, values: spec, ...(usesCoupon ? { couponId } : {}) }]
    if (labelId) actions.push({ type: "ADD_LABEL", labelId })
    onSave({
      name: name.trim(),
      triggerType: trigger,
      triggerConfig: trigger === "CART_ABANDONED" ? { delayMinutes: delay } : { status },
      conditions: cleanConditions(rows),
      actions,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit workflow" : "New workflow"}</DialogTitle>
          <DialogDescription>Saved switched off. You turn it on when you are ready; it only reacts to events after that moment.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label htmlFor="w-name">Name</Label>
            <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Cart reminder with 10% off" className="mt-1" />
          </div>

          <section aria-label="When" className="rounded-lg border p-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">When</h4>
            <select aria-label="What starts this workflow" className="mt-2 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-60" value={trigger} disabled={editing} onChange={(e) => { setTrigger(e.target.value as WorkflowTrigger); setRows([]); setTemplateId(""); setValues({}); setCouponId("") }}>
              {(Object.keys(TRIGGER_LABEL) as WorkflowTrigger[]).map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}
            </select>
            {editing && <p className="mt-1 text-[11px] text-muted-foreground">The trigger can’t be changed. Create a new workflow instead.</p>}
            {trigger === "CART_ABANDONED" ? (
              <div className="mt-2">
                <Label htmlFor="w-delay" className="text-xs">…and still hasn’t bought after</Label>
                <select id="w-delay" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={delay} onChange={(e) => setDelay(Number(e.target.value))}>
                  {DELAYS.map((d) => <option key={d} value={d}>{d < 60 ? `${d} minutes` : `${d / 60} hour${d === 60 ? "" : "s"}`}</option>)}
                  {!DELAYS.includes(delay) && <option value={delay}>{delay} minutes</option>}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">Carts left more than 2 hours past this time are not reminded.</p>
              </div>
            ) : (
              <div className="mt-2">
                <Label htmlFor="w-status" className="text-xs">…becomes</Label>
                <select id="w-status" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {ORDER_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">Messages are only sent within 30 minutes of the change, never late.</p>
              </div>
            )}
          </section>

          <section aria-label="If" className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">If (optional)</h4>
              <Button type="button" variant="ghost" size="sm" disabled={rows.length >= 5 || !info} onClick={() => setRows((r) => [...r, { field: info!.fields[0], op: "gt", value: "" }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add condition</Button>
            </div>
            {rows.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No conditions — it applies to every event.</p>}
            {rows.map((r, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <select aria-label={`Condition ${i + 1} field`} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" value={r.field} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { field: e.target.value, op: TEXT_FIELDS.has(e.target.value) ? "eq" : x.op, value: "" } : x)))}>
                  {(info?.fields ?? []).map((f) => <option key={f} value={f}>{FIELD_LABEL[f] ?? f}</option>)}
                </select>
                <select aria-label={`Condition ${i + 1} comparison`} className="h-9 rounded-md border bg-background px-2 text-sm" value={r.op} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, op: e.target.value as ConditionOp } : x)))}>
                  {(TEXT_FIELDS.has(r.field) ? TEXT_OPS : NUM_OPS).map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
                </select>
                <Input aria-label={`Condition ${i + 1} value`} className="w-28" value={r.value} inputMode={TEXT_FIELDS.has(r.field) ? "text" : "numeric"} placeholder={TEXT_FIELDS.has(r.field) ? "COD" : "500"} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove condition ${i + 1}`} onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </section>

          <section aria-label="Do" className="rounded-lg border p-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Do</h4>
            <Label htmlFor="w-tpl" className="mt-2 block text-xs">Send this message</Label>
            <select id="w-tpl" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setValues({}) }}>
              <option value="">Choose an approved template…</option>
              {(templates.data?.templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.meta_category.toLowerCase()}</option>)}
            </select>
            {tpl && <p className="mt-2 whitespace-pre-line rounded-md bg-emerald-50 p-2 text-xs dark:bg-emerald-950/30">{tpl.body_text}</p>}
            {tpl && tpl.meta_category === "MARKETING" && trigger === "ORDER_STATUS" && (
              <p className="mt-1 text-xs text-amber-800">This is a marketing template. Order updates should use a utility template — they reach more customers and cost less.</p>
            )}
            {tokens.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">Filled in automatically: {tokenHint(autoFilled)}</p>}

            {trigger === "CART_ABANDONED" && (
              <div className="mt-3">
                <Label htmlFor="w-coupon" className="text-xs">Attach a coupon (optional)</Label>
                <select id="w-coupon" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={couponId} onChange={(e) => setCouponId(e.target.value)}>
                  <option value="">No coupon</option>
                  {publicCoupons.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">Only coupons anyone can use are listed. If the coupon stops working, no message is sent.</p>
              </div>
            )}

            {needTyped.map((v) => (
              <div key={String(v.key ?? v.name)} className="mt-3">
                <Label htmlFor={`wv-${v.name}`} className="text-xs">{v.name.replace(/_/g, " ")}</Label>
                <Input id={`wv-${v.name}`} value={values[String(v.key ?? v.name)] ?? ""} onChange={(e) => setValues((cur) => ({ ...cur, [String(v.key ?? v.name)]: e.target.value }))} placeholder={v.example} maxLength={500} className="mt-0.5" />
              </div>
            ))}
            {trigger === "CART_ABANDONED" && catalog.data && !catalog.data.cartLinkConfigured && tpl && JSON.stringify(tpl.variables).includes("cart_") && (
              <p role="alert" className="mt-2 text-xs text-amber-800">The cart link is not set up on the server yet (CUSTOMER_APP_URL), so this workflow cannot be switched on.</p>
            )}

            <div className="mt-3">
              <Label htmlFor="w-label" className="text-xs">Also add a label (optional)</Label>
              <select id="w-label" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={labelId} onChange={(e) => setLabelId(e.target.value)}>
                <option value="">No label</option>
                {(labels.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || saving} onClick={submit}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
