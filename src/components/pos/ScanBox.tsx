"use client"

import { useEffect, useRef, useState } from "react"
import { ScanLine } from "lucide-react"
import { Input } from "@/components/ui/input"
import { beep, scanFeedback, type ScanFeedback } from "./pos-helpers"
import { posErrorCode, posErrorMessage, usePosMutations } from "@/hooks/usePos"
import { cn } from "@/lib/utils"
import type { Stage } from "@/types/pos.types"

/** A barcode scanner types the code and presses Enter, so one focused input is all it takes. A wrong scan is loud. */
export function ScanBox({ orderId, stage }: { orderId: string; stage: Stage }) {
  const { scan } = usePosMutations()
  const [code, setCode] = useState("")
  const [fb, setFb] = useState<ScanFeedback | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { ref.current?.focus() }, [stage])

  const submit = async () => {
    const value = code.trim()
    if (!value) return
    setCode("")
    try {
      const res = await scan.mutateAsync({ id: orderId, stage, code: value })
      const f = scanFeedback(res, stage)
      setFb(f)
      beep("ok")
    } catch (err) {
      setFb(scanFeedback({ code: posErrorCode(err), message: posErrorMessage(err) }, stage))
      beep("bad")
    } finally {
      ref.current?.focus()
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="relative">
        <ScanLine className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" aria-hidden />
        <Input
          ref={ref}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={stage === "PICK" ? "Scan each item as you collect it" : "Scan each item to verify it into the package"}
          aria-label="Scan a barcode"
          autoComplete="off"
          className="h-11 pl-10 text-base"
        />
      </form>
      {fb && (
        <div role={fb.tone === "bad" ? "alert" : "status"} className={cn("rounded-md px-3 py-2", fb.tone === "bad" ? "bg-red-600 text-white" : "bg-emerald-100 text-emerald-900")}>
          <p className="font-bold">{fb.tone === "ok" ? "✓ " : ""}{fb.title}</p>
          {fb.detail && <p className="text-sm">{fb.detail}</p>}
        </div>
      )}
    </div>
  )
}
