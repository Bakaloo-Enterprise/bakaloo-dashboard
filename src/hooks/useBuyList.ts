"use client"

import { useSyncExternalStore } from "react"
import { addLine, loadList, saveList, type BuyLine } from "@/components/business/buylist"

/**
 * The owner's buy list: ONE list shared by every part of the screen (the product sheet adds to it, the To-buy cards show
 * what is in it, the Buy list dialog edits it). It lives in this browser — a convenience, not shared records; recorded
 * purchases are what everyone sees.
 */
const EMPTY: BuyLine[] = []
let current: BuyLine[] = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  current = loadList()
  // another tab changed the list
  window.addEventListener("storage", (e) => { if (e.key === "bakaloo-buy-list-v1") { current = loadList(); listeners.forEach((l) => l()) } })
}

function commit(fn: (l: BuyLine[]) => BuyLine[]) {
  ensureLoaded()
  current = fn(current)
  saveList(current)
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => { ensureLoaded(); listeners.add(cb); return () => { listeners.delete(cb) } }
const getSnapshot = () => { ensureLoaded(); return current }
const getServerSnapshot = () => EMPTY

export function useBuyList() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return {
    list,
    add: (line: BuyLine) => commit((l) => addLine(l, line)),
    update: (i: number, patch: Partial<BuyLine>) => commit((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x))),
    remove: (i: number) => commit((l) => l.filter((_, k) => k !== i)),
    removeMany: (keep: (l: BuyLine) => boolean) => commit((l) => l.filter(keep)),
    clear: () => commit(() => EMPTY),
  }
}
