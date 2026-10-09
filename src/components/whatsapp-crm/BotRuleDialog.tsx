"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { BotAction, BotMatchType, BotRule, BotRuleInput, BotWhenHours } from "@/types/whatsapp-crm.types"
import { Switch } from "@/components/ui/switch"
import { ACTION_LABEL, MATCH_LABEL, NO_KEYWORD_TYPES, parseKeywords, VARIABLES, WHEN_LABEL } from "./bot-helpers"

interface Props {
  open: boolean
  rule: BotRule | null
  saving: boolean
  onClose: () => void
  onSave: (input: BotRuleInput) => void
}

export function BotRuleDialog({ open, rule, saving, onClose, onSave }: Props) {
  const [name, setName] = useState("")
  const [matchType, setMatchType] = useState<BotMatchType>("CONTAINS")
  const [keywords, setKeywords] = useState("")
  const [exact, setExact] = useState("")
  const [whenHours, setWhenHours] = useState<BotWhenHours>("ANY")
  const [action, setAction] = useState<BotAction>("REPLY")
  const [reply, setReply] = useState("")
  const [replyGu, setReplyGu] = useState("")
  const [replyGl, setReplyGl] = useState("")
  const [asksArea, setAsksArea] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!open) return
    setName(rule?.name ?? "")
    setMatchType(rule?.match_type ?? "CONTAINS")
    setKeywords(rule?.keywords.join("\n") ?? "")
    setExact(rule?.exact_keywords.join("\n") ?? "")
    setWhenHours(rule?.when_hours ?? "ANY")
    setAction(rule?.action ?? "REPLY")
    setReply(rule?.reply_text ?? "")
    setReplyGu(rule?.reply_text_gu ?? "")
    setReplyGl(rule?.reply_text_gl ?? "")
    setAsksArea(rule?.asks_area ?? false)
    setCooldown(rule?.cooldown_minutes ?? 0)
  }, [open, rule])

  const needsReply = action !== "HANDOFF" && action !== "IGNORE"
  const needsKeywords = !NO_KEYWORD_TYPES.includes(matchType)
  const valid = name.trim() && (!needsKeywords || parseKeywords(keywords).length + parseKeywords(exact).length > 0) && (!needsReply || reply.trim())

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>The first matching rule, from top to bottom, answers the customer.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="rule-name">Rule name</Label>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Wholesale enquiry" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>When</Label>
              <Select value={matchType} onValueChange={(v) => setMatchType(v as BotMatchType)}>
                <SelectTrigger aria-label="Match type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MATCH_LABEL) as BotMatchType[]).map((k) => (
                    <SelectItem key={k} value={k}>{MATCH_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Store hours</Label>
              <Select value={whenHours} onValueChange={(v) => setWhenHours(v as BotWhenHours)}>
                <SelectTrigger aria-label="Store hours condition"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(WHEN_LABEL) as BotWhenHours[]).map((k) => (
                    <SelectItem key={k} value={k}>{WHEN_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsKeywords && (
            <>
              <div>
                <Label htmlFor="rule-keywords">Words or phrases (one per line)</Label>
                <Textarea id="rule-keywords" rows={3} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={"wholesale\nbulk order"} />
                <p className="mt-1 text-xs text-muted-foreground">Works in any language. Capitals and punctuation are ignored.</p>
              </div>
              <div>
                <Label htmlFor="rule-exact">Exact replies (whole message only)</Label>
                <Textarea id="rule-exact" rows={2} value={exact} onChange={(e) => setExact(e.target.value)} placeholder="2" />
                <p className="mt-1 text-xs text-muted-foreground">Use this for menu numbers and very short words, so “2 kg onions” does not trigger “2”.</p>
              </div>
            </>
          )}

          <div>
            <Label>Then</Label>
            <Select value={action} onValueChange={(v) => setAction(v as BotAction)}>
              <SelectTrigger aria-label="Action"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ACTION_LABEL) as BotAction[]).map((k) => (
                  <SelectItem key={k} value={k}>{ACTION_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsReply && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="rule-reply">Reply in English</Label>
                <Textarea id="rule-reply" rows={5} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} />
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  Insert:
                  {VARIABLES.map((v) => (
                    <button key={v.key} type="button" title={v.hint} onClick={() => setReply((r) => `${r}{{${v.key}}}`)} className="rounded bg-muted px-1.5 py-0.5 font-mono hover:bg-muted/70">
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="rule-reply-gu">Reply in Gujarati (ગુજરાતી)</Label>
                <Textarea id="rule-reply-gu" rows={4} value={replyGu} onChange={(e) => setReplyGu(e.target.value)} maxLength={1000} placeholder="Used when the customer writes in Gujarati script" />
              </div>
              <div>
                <Label htmlFor="rule-reply-gl">Reply in Gujarati written in English letters</Label>
                <Textarea id="rule-reply-gl" rows={4} value={replyGl} onChange={(e) => setReplyGl(e.target.value)} maxLength={1000} placeholder="Used when the customer writes e.g. “Tamaro area kyo chhe”" />
                <p className="mt-1 text-xs text-muted-foreground">If a language is left empty, the customer gets the English reply.</p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div>
                  <Label htmlFor="rule-asks-area" className="text-sm">This reply asks “which area are you in?”</Label>
                  <p className="text-xs text-muted-foreground">The customer’s next short answer is then read as an area name.</p>
                </div>
                <Switch id="rule-asks-area" checked={asksArea} onCheckedChange={setAsksArea} aria-label="This reply asks the customer for their area" />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="rule-cooldown">Don’t repeat this reply within (minutes, 0 = always answer)</Label>
            <Input id="rule-cooldown" type="number" min={0} max={1440} value={cooldown} onChange={(e) => setCooldown(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))} className="w-32" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid || saving}
            onClick={() =>
              onSave({
                name: name.trim(),
                matchType,
                keywords: needsKeywords ? parseKeywords(keywords) : [],
                exactKeywords: needsKeywords ? parseKeywords(exact) : [],
                whenHours,
                action,
                replyText: needsReply ? reply.trim() : null,
                replyTextGu: needsReply ? replyGu.trim() || null : null,
                replyTextGl: needsReply ? replyGl.trim() || null : null,
                asksArea: needsReply ? asksArea : false,
                cooldownMinutes: cooldown,
              })
            }
          >
            {saving ? "Saving…" : "Save rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
