"use client"

/**
 * DemoModeGuard — for a demo viewer account only. The API already limits the data to the demo customers and masks every
 * other phone / e-mail / vendor / rider name as "98••••••12". This adds the visual blur on top: any text that contains
 * a run of "•" gets the `demo-blur` class, wherever it is rendered (tables, dialogs, WhatsApp CRM, notifications...).
 * It also shows a small "Demo account" ribbon. Renders nothing for everyone else.
 */

import { useEffect } from "react"
import { Eye, FlaskConical } from "lucide-react"
import { useFeatures } from "@/hooks/useFeatures"

const MASKED = /•{3,}/

function blurMasked(root: ParentNode) {
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const parent = node.parentElement
    if (parent && MASKED.test(node.nodeValue ?? "") && !parent.classList.contains("demo-blur")) {
      parent.classList.add("demo-blur")
    }
    node = walker.nextNode()
  }
}

/** Pill for the top header: makes it obvious this login shows demo data, not production. */
export function DemoHeaderBadge() {
  const isDemo = useFeatures().data?.isDemoViewer === true
  if (!isDemo) return null
  return (
    <div
      data-testid="demo-header-badge"
      title="View-only demo account. Orders, wallet, refunds and chats show demo customers only; other customers' contact details are hidden."
      className="hidden items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 sm:flex"
    >
      <FlaskConical className="h-3.5 w-3.5" />
      Demo data — not production
    </div>
  )
}

export function DemoModeGuard() {
  const isDemo = useFeatures().data?.isDemoViewer === true

  useEffect(() => {
    if (!isDemo) return
    blurMasked(document.body)
    let queued = false
    const observer = new MutationObserver(() => {
      if (queued) return
      queued = true
      window.setTimeout(() => {
        queued = false
        blurMasked(document.body)
      }, 50)
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [isDemo])

  // Inputs keep their value in a property, not a text node, so blur those too.
  useEffect(() => {
    if (!isDemo) return
    const id = window.setInterval(() => {
      document.querySelectorAll<HTMLInputElement>("input, textarea").forEach((el) => {
        el.classList.toggle("demo-blur", MASKED.test(el.value ?? ""))
      })
    }, 700)
    return () => window.clearInterval(id)
  }, [isDemo])

  if (!isDemo) return null
  return (
    <div
      data-testid="demo-ribbon"
      className="mb-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
    >
      <Eye className="h-4 w-4" />
      Demo account (view-only) — this is demo data, not production. You can review everything, but saving, deleting, sending and publishing are switched off. Orders, wallet, refunds and chats show the demo customers only; every other customer's contact details are hidden.
    </div>
  )
}
