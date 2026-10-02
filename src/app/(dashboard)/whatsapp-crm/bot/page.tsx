"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { BotRuleDialog } from "@/components/whatsapp-crm/BotRuleDialog"
import { BotTester } from "@/components/whatsapp-crm/BotTester"
import { ACTION_LABEL, keywordSummary, WHEN_LABEL } from "@/components/whatsapp-crm/bot-helpers"
import { useBotActivity, useBotMutations, useBotRules, useBotSettings, useCrmMe } from "@/hooks/useWhatsappCrm"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { BotRule, BotRuleInput } from "@/types/whatsapp-crm.types"

const PAUSE_OPTIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 360, label: "6 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hours" },
]

const OUTCOME_LABEL: Record<string, string> = {
  REPLIED: "Replied",
  HANDOFF: "Handed to a person",
  NO_MATCH: "No rule matched",
  MEDIA: "Photo / voice → person",
  RATE_LIMITED: "Too many replies → person",
  SEND_FAILED: "Send failed → person",
  SKIPPED_COOLDOWN: "Skipped (already answered)",
  SKIPPED_STALE: "Skipped (too old)",
}

export default function BotPage() {
  const me = useCrmMe()
  const allowed = me.can("crm.bot.manage")
  const settings = useBotSettings(allowed)
  const rules = useBotRules(allowed)
  const activity = useBotActivity(allowed)
  const m = useBotMutations()

  const [editing, setEditing] = useState<BotRule | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [fallbackText, setFallbackText] = useState("")
  const [maxReplies, setMaxReplies] = useState(6)

  useEffect(() => {
    if (settings.data) {
      setFallbackText(settings.data.fallback_text)
      setMaxReplies(settings.data.max_replies_per_hour)
    }
  }, [settings.data])

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!allowed) return <Forbidden />

  const s = settings.data
  const list = rules.data ?? []
  const move = (i: number, dir: -1 | 1) => {
    const ids = list.map((r) => r.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    m.reorder.mutate(ids)
  }
  const save = (input: BotRuleInput) => {
    const opts = { onSuccess: () => setDialogOpen(false) }
    if (editing) m.updateRule.mutate({ id: editing.id, input }, opts)
    else m.createRule.mutate(input, opts)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Auto-reply Bot" subtitle="Simple keyword rules that answer common questions. No AI — you control every word. Anything it can’t answer goes to your team." />

      {/* master switch */}
      <section className={cn("rounded-lg border p-4", s?.enabled ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-card")} aria-label="Bot on or off">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">{s?.enabled ? "The bot is ON" : "The bot is OFF"}</h3>
            <p className="text-xs text-muted-foreground">
              {s?.enabled ? "It answers customers automatically using the rules below." : "Nothing is sent automatically. Test your rules below, then turn it on."}
            </p>
          </div>
          <Switch
            checked={Boolean(s?.enabled)}
            disabled={!s || m.saveSettings.isPending}
            onCheckedChange={(v) => m.saveSettings.mutate({ enabled: v })}
            aria-label="Turn the auto-reply bot on or off"
          />
        </div>
      </section>

      <BotTester />

      {/* settings */}
      {s && (
        <section className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2" aria-label="Bot settings">
          <div>
            <Label htmlFor="pause">After a person replies, the bot stays quiet for</Label>
            <select
              id="pause"
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={s.human_pause_minutes}
              onChange={(e) => m.saveSettings.mutate({ humanPauseMinutes: Number(e.target.value) })}
            >
              {PAUSE_OPTIONS.map((o) => (
                <option key={o.minutes} value={o.minutes}>{o.label}</option>
              ))}
              {!PAUSE_OPTIONS.some((o) => o.minutes === s.human_pause_minutes) && <option value={s.human_pause_minutes}>{s.human_pause_minutes} minutes</option>}
            </select>
          </div>
          <div>
            <Label htmlFor="maxr">Safety limit: most bot replies per chat per hour</Label>
            <div className="mt-1 flex gap-2">
              <Input id="maxr" type="number" min={1} max={60} value={maxReplies} onChange={(e) => setMaxReplies(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} className="w-24" />
              <Button variant="outline" disabled={maxReplies === s.max_replies_per_hour || m.saveSettings.isPending} onClick={() => m.saveSettings.mutate({ maxRepliesPerHour: maxReplies })}>Save</Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fallback">When no rule matches, send this once and call a person</Label>
              <Switch checked={s.fallback_enabled} onCheckedChange={(v) => m.saveSettings.mutate({ fallbackEnabled: v })} aria-label="Send a message when no rule matches" />
            </div>
            <Textarea id="fallback" rows={2} value={fallbackText} onChange={(e) => setFallbackText(e.target.value)} disabled={!s.fallback_enabled} className="mt-1" maxLength={1000} />
            <Button className="mt-2" variant="outline" size="sm" disabled={!s.fallback_enabled || !fallbackText.trim() || fallbackText.trim() === s.fallback_text || m.saveSettings.isPending} onClick={() => m.saveSettings.mutate({ fallbackText })}>
              Save message
            </Button>
          </div>
        </section>
      )}

      {/* rules */}
      <section aria-label="Rules">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Rules <span className="font-normal text-muted-foreground">(top to bottom, first match wins)</span></h3>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="mr-1 h-4 w-4" /> New rule</Button>
        </div>
        <ul className="divide-y rounded-lg border bg-card">
          {rules.isLoading && <li className="p-3"><Skeleton className="h-10 w-full" /></li>}
          {list.map((r, i) => (
            <li key={r.id} className={cn("flex items-start gap-3 p-3", !r.is_active && "opacity-60")}>
              <div className="flex flex-col">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0 || m.reorder.isPending} onClick={() => move(i, -1)} aria-label={`Move ${r.name} up`}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === list.length - 1 || m.reorder.isPending} onClick={() => move(i, 1)} aria-label={`Move ${r.name} down`}><ArrowDown className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{r.name}</span>
                  {r.when_hours !== "ANY" && <Badge variant="outline" className="text-[10px]">{WHEN_LABEL[r.when_hours]}</Badge>}
                  {r.action !== "REPLY" && <Badge variant="secondary" className="text-[10px]">{ACTION_LABEL[r.action]}</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">If: {keywordSummary(r)}</p>
                {r.reply_text && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs">{r.reply_text}</p>}
              </div>
              <Switch checked={r.is_active} onCheckedChange={(v) => m.updateRule.mutate({ id: r.id, input: { isActive: v } })} aria-label={`${r.name} enabled`} />
              <Button variant="ghost" size="icon" aria-label={`Edit ${r.name}`} onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${r.name}`} onClick={() => { if (window.confirm(`Delete the rule “${r.name}”?`)) m.deleteRule.mutate(r.id) }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </li>
          ))}
        </ul>
      </section>

      {/* activity */}
      <section aria-label="Recent bot activity">
        <h3 className="mb-2 text-sm font-semibold">Recent activity</h3>
        <ul className="divide-y rounded-lg border bg-card text-sm">
          {(activity.data ?? []).length === 0 && <li className="p-3 text-xs text-muted-foreground">Nothing yet. When the bot answers or hands a chat to a person, it appears here.</li>}
          {(activity.data ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span><span className="font-medium">{e.contact ?? "Unknown"}</span> — {OUTCOME_LABEL[e.outcome] ?? e.outcome}{e.rule_name ? ` (${e.rule_name})` : ""}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(e.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      <BotRuleDialog open={dialogOpen} rule={editing} saving={m.createRule.isPending || m.updateRule.isPending} onClose={() => setDialogOpen(false)} onSave={save} />
    </div>
  )
}
