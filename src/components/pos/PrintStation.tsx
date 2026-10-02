"use client"

import { useEffect, useRef, useState } from "react"
import { posErrorMessage, printStationApi, useJobs } from "@/hooks/usePos"

/**
 * Turns THIS browser into the print station for one printer: it reports in (heartbeat), takes the next queued job for
 * the printer, loads the ready-made page, prints it from a hidden frame and tells the server how it went.
 * The browser's own print dialog picks the physical device, so keep this tab open on the PC the printer is attached to.
 */
export function PrintStation({ printerId, printerName }: { printerId: string; printerName: string }) {
  const queued = useJobs({ status: "QUEUED", printerId }, true, 5_000)
  const [log, setLog] = useState<string>("Waiting for jobs…")
  const busy = useRef(false)

  useEffect(() => {
    const beat = () => void printStationApi.heartbeat(printerId).catch(() => undefined)
    beat()
    const t = setInterval(beat, 30_000)
    return () => clearInterval(t)
  }, [printerId])

  useEffect(() => {
    const next = queued.data?.[0]
    if (!next || busy.current) return
    busy.current = true
    void (async () => {
      try {
        await printStationApi.claimJob(next.id)
      } catch {
        busy.current = false // someone else took it
        return
      }
      try {
        setLog(`Printing ${next.kind.toLowerCase()}${next.orderNumber ? ` for #${next.orderNumber}` : ""}…`)
        const doc = await printStationApi.getDocument(next.id)
        await printHtml(doc.html)
        await printStationApi.reportJob(next.id, true)
        setLog(`Sent ${next.kind.toLowerCase()}${next.orderNumber ? ` #${next.orderNumber}` : ""} to the printer.`)
      } catch (err) {
        await printStationApi.reportJob(next.id, false, posErrorMessage(err).slice(0, 300)).catch(() => undefined)
        setLog(`Could not print: ${posErrorMessage(err)}`)
      } finally {
        busy.current = false
        void queued.refetch()
      }
    })()
  }, [queued.data, queued])

  return (
    <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      This computer is the print station for <strong>{printerName}</strong>. {log}
    </p>
  )
}

function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe")
    frame.setAttribute("aria-hidden", "true")
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
    frame.srcdoc = html
    frame.onload = () => {
      try {
        frame.contentWindow?.focus()
        frame.contentWindow?.print()
        setTimeout(() => { frame.remove(); resolve() }, 1500)
      } catch (e) {
        frame.remove()
        reject(e)
      }
    }
    document.body.appendChild(frame)
  })
}
