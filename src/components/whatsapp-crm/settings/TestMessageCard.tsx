"use client"

import { useState } from "react"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Optional: really send Meta’s sample “hello_world” message to a phone, to see it arrive. */
export function TestMessageCard({ disabled, busy, onSend }: { disabled: boolean; busy: boolean; onSend: (phone: string) => void }) {
  const [phone, setPhone] = useState("")
  const digits = phone.replace(/\D/g, "")
  const valid = digits.length === 10 || (digits.length === 12 && digits.startsWith("91"))
  return (
    <section aria-label="Send a test message" className="space-y-3 rounded-2xl border bg-card p-6 shadow-sm">
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Send className="h-5 w-5" aria-hidden /></span>
        <div>
          <h2 className="text-base font-semibold">Send a test message</h2>
          <p className="text-sm text-muted-foreground">Sends Meta’s sample “hello_world” message so you can see it arrive on a real phone.</p>
        </div>
      </header>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (valid && !disabled) onSend(digits) }}>
        <div className="space-y-1">
          <label htmlFor="wa-test-phone" className="text-xs font-medium text-muted-foreground">Mobile number (India)</label>
          <Input id="wa-test-phone" inputMode="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 w-52" />
        </div>
        <Button type="submit" variant="outline" disabled={!valid || disabled || busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Send className="mr-2 h-4 w-4" aria-hidden />}Send test message</Button>
      </form>
      <p className="text-xs text-muted-foreground">While your number is in Meta’s test mode, the phone must be on your allowed list (Meta → API Setup → “To”). One sample message is billed by Meta only if it is a paid category.</p>
    </section>
  )
}
