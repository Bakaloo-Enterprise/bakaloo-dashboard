"use client"

import { useState } from "react"
import { FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBotMutations } from "@/hooks/useWhatsappCrm"

const OUTCOME_TEXT = {
  REPLIED: "The bot answers",
  HANDOFF: "The bot answers, then hands to a person",
  NO_MATCH: "No rule matches: handed to a person",
} as const

/** Dry run: which rule would answer this message? Sends nothing. */
export function BotTester() {
  const [message, setMessage] = useState("")
  const [when, setWhen] = useState<"NOW" | "OPEN" | "CLOSED">("NOW")
  const { test } = useBotMutations()
  const r = test.data

  return (
    <section className="rounded-lg border bg-card p-4" aria-label="Try a message">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><FlaskConical className="h-4 w-4" aria-hidden /> Try a message</h3>
      <p className="mb-3 text-xs text-muted-foreground">Type what a customer might write. Nothing is sent — you just see which rule would answer.</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (message.trim()) test.mutate({ message: message.trim(), when })
        }}
      >
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. hi, where is my order?" className="min-w-52 flex-1" aria-label="Customer message to test" maxLength={500} />
        <Select value={when} onValueChange={(v) => setWhen(v as typeof when)}>
          <SelectTrigger className="w-40" aria-label="Store hours for the test"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NOW">Store status now</SelectItem>
            <SelectItem value="OPEN">Pretend it is open</SelectItem>
            <SelectItem value="CLOSED">Pretend it is closed</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!message.trim() || test.isPending}>Test</Button>
      </form>

      {r && (
        <div className="mt-3 space-y-2" role="status">
          <p className="text-sm">
            <span className="font-medium">{r.rule ? `Rule: ${r.rule.name}` : "No rule matched"}</span>
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{OUTCOME_TEXT[r.outcome]}</span>
            <span className="ml-2 text-xs text-muted-foreground">(store {r.isOpen ? "open" : "closed"})</span>
          </p>
          {r.reply ? (
            <div className="max-w-md whitespace-pre-wrap rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-50">{r.reply}</div>
          ) : (
            <p className="text-xs text-muted-foreground">The bot would send no message.</p>
          )}
        </div>
      )}
    </section>
  )
}
