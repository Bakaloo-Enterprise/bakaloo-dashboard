"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { WaSettingsInput, WaSettingsView } from "@/types/whatsapp-settings.types"
import { FIELD_HELP, copyToClipboard } from "./settings-helpers"

type Key = keyof typeof FIELD_HELP

interface Props {
  view: WaSettingsView
  busy: boolean
  errors: Record<string, string>
  /** Save the changed fields, then (when `thenTest`) test the connection. */
  onSubmit: (input: WaSettingsInput, thenTest: boolean) => void
  onRemove: () => void
}

const SOURCE_NOTE = "Currently set on the server. Saving a value here replaces it."

/** The five values from Meta (+ optional App ID). Secrets are never shown back — only “saved”. */
export function CredentialsForm({ view, busy, errors, onSubmit, onRemove }: Props) {
  const f = view.fields
  const [v, setV] = useState({ phoneNumberId: f.phoneNumberId.value ?? "", wabaId: f.wabaId.value ?? "", appId: f.appId.value ?? "", accessToken: "", appSecret: "", verifyToken: f.verifyToken.value ?? "" })
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [confirmRemove, setConfirmRemove] = useState(false)

  // After a save the server is the truth for the plain fields.
  useEffect(() => {
    setV((x) => ({ ...x, phoneNumberId: f.phoneNumberId.value ?? "", wabaId: f.wabaId.value ?? "", appId: f.appId.value ?? "", verifyToken: f.verifyToken.value ?? "" }))
  }, [f.phoneNumberId.value, f.wabaId.value, f.appId.value, f.verifyToken.value])

  // A secret that was just saved must not linger in its box — from now on it only shows as “Saved”.
  useEffect(() => { setV((x) => ({ ...x, accessToken: "" })) }, [f.accessToken.masked])
  useEffect(() => { setV((x) => ({ ...x, appSecret: "" })) }, [f.appSecret.masked])

  const changed: WaSettingsInput = {}
  if (v.phoneNumberId.trim() !== (f.phoneNumberId.value ?? "")) changed.phoneNumberId = v.phoneNumberId
  if (v.wabaId.trim() !== (f.wabaId.value ?? "")) changed.wabaId = v.wabaId
  if (v.appId.trim() !== (f.appId.value ?? "")) changed.appId = v.appId
  if (v.verifyToken.trim() !== (f.verifyToken.value ?? "")) changed.verifyToken = v.verifyToken
  if (v.accessToken.trim()) changed.accessToken = v.accessToken
  if (v.appSecret.trim()) changed.appSecret = v.appSecret
  const dirty = Object.keys(changed).length > 0
  const hasCore = Boolean((v.phoneNumberId.trim() || f.phoneNumberId.value) && (v.accessToken.trim() || f.accessToken.configured))
  const needsTest = view.state !== "CONNECTED"

  const input = (key: Key, opts: { secret?: boolean; mono?: boolean; required?: boolean; saved?: string; source?: string | null; extra?: React.ReactNode } = {}) => {
    const h = FIELD_HELP[key]
    const err = errors[key]
    const id = `wa-${key}`
    const isSecret = opts.secret
    return (
      <div key={key} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-medium">
            {h.label}{opts.required && <span className="text-red-600" aria-hidden> *</span>}
            {!opts.required && <span className="ml-1 text-xs font-normal text-muted-foreground">optional</span>}
          </label>
          {opts.saved && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><Check className="h-3 w-3" aria-hidden />Saved · {opts.saved}</span>}
        </div>
        <div className="relative">
          <Input
            id={id}
            type={isSecret && !show[key] ? "password" : "text"}
            autoComplete="off"
            spellCheck={false}
            value={v[key]}
            onChange={(e) => setV((x) => ({ ...x, [key]: e.target.value }))}
            placeholder={opts.saved ? "Leave empty to keep the saved value" : isSecret ? "Paste it here" : ""}
            aria-invalid={Boolean(err)}
            aria-describedby={`${id}-hint`}
            className={cn("h-10 pr-10", opts.mono && "font-mono text-[13px]", err && "border-red-400 focus-visible:ring-red-300")}
          />
          {isSecret && (
            <button type="button" aria-label={show[key] ? `Hide ${h.label}` : `Show ${h.label}`} onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))} className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground">
              {show[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {err ? <p role="alert" className="text-xs text-red-600">{err}</p> : <p id={`${id}-hint`} className="text-xs text-muted-foreground">{h.hint} <span className="text-muted-foreground/80">Find it: {h.where}.</span></p>}
        {opts.source === "server" && <p className="text-[11px] text-sky-700">{SOURCE_NOTE}</p>}
        {opts.extra}
      </div>
    )
  }

  const copyToken = async () => toast[(await copyToClipboard(v.verifyToken)) ? "success" : "error"]((await copyToClipboard(v.verifyToken)) ? "Verify token copied" : "Could not copy")

  return (
    <form
      aria-label="WhatsApp API details"
      onSubmit={(e) => { e.preventDefault(); if (dirty || needsTest) onSubmit(changed, true) }}
      className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><KeyRound className="h-5 w-5" aria-hidden /></span>
        <div>
          <h2 className="text-base font-semibold">Your WhatsApp API details</h2>
          <p className="text-sm text-muted-foreground">Copy these from your Meta app. They are stored encrypted and never shown again after saving.</p>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {input("phoneNumberId", { required: true, mono: true, source: f.phoneNumberId.source })}
        {input("wabaId", { mono: true, source: f.wabaId.source })}
        <div className="md:col-span-2">
          {input("accessToken", { secret: true, mono: true, required: true, saved: f.accessToken.configured ? f.accessToken.masked : undefined, source: f.accessToken.source })}
        </div>
        {input("appSecret", { secret: true, mono: true, saved: f.appSecret.configured ? f.appSecret.masked : undefined, source: f.appSecret.source })}
        {input("appId", { mono: true, source: f.appId.source })}
        <div className="md:col-span-2">
          {input("verifyToken", {
            mono: true, source: f.verifyToken.source,
            extra: (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onSubmit({ generateVerifyToken: true }, false)}><Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden />Generate a secure token</Button>
                <Button type="button" variant="outline" size="sm" disabled={!v.verifyToken} onClick={copyToken}><Copy className="mr-1 h-3.5 w-3.5" aria-hidden />Copy</Button>
              </div>
            ),
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy || !hasCore || (!dirty && !needsTest)} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {busy ? "Working…" : "Save & test connection"}
          </Button>
          <Button type="button" variant="outline" disabled={busy || !dirty} onClick={() => onSubmit(changed, false)}>Save only</Button>
          {!hasCore && <span className="text-xs text-muted-foreground">Enter at least the Phone number ID and Access token.</span>}
        </div>
        {(f.accessToken.source === "dashboard" || f.phoneNumberId.source === "dashboard") && (
          confirmRemove ? (
            <span className="flex items-center gap-2 text-xs">
              Remove all saved details?
              <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => { setConfirmRemove(false); onRemove() }}>Yes, remove</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>No</Button>
            </span>
          ) : (
            <button type="button" className="text-xs text-red-700 underline-offset-2 hover:underline" onClick={() => setConfirmRemove(true)}>Remove saved details</button>
          )
        )}
      </div>
    </form>
  )
}
