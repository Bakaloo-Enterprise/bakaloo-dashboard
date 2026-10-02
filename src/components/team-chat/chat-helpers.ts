import type { ChatMember, ChatMessage, ChatRef } from "@/types/team-chat.types"

/** Letters, digits, underscore — and any non-ASCII character (so Hindi/Bengali names count as words). */
const WORD = /[A-Za-z0-9_\u0080-\uFFFF]/

export interface Mentionable {
  id: string
  name: string
}

/** Names longest-first so “@Asha Sharma” is not also read as “@Asha”. */
const byLongestName = (people: Mentionable[]) => [...people].filter((p) => p.name.trim()).sort((a, b) => b.name.length - a.name.length)

/**
 * Who does this text mention? A person counts when “@Their Name” appears and the
 * character after it is not part of a longer word. The server keeps only channel members anyway.
 */
export function extractMentions(text: string, people: Mentionable[]): string[] {
  let rest = text
  const out: string[] = []
  for (const p of byLongestName(people)) {
    const token = `@${p.name}`
    let idx = rest.indexOf(token)
    let found = false
    while (idx !== -1) {
      const next = rest[idx + token.length]
      if (!next || !WORD.test(next)) {
        found = true
        rest = rest.slice(0, idx) + " ".repeat(token.length) + rest.slice(idx + token.length)
      }
      idx = rest.indexOf(token, idx + token.length)
    }
    if (found && !out.includes(p.id)) out.push(p.id)
  }
  return out
}

export type Segment = { text: string; mention: boolean }

/** Cut a message into plain and @mention pieces (only people actually mentioned are highlighted). */
export function splitMentions(body: string, mentionedIds: string[], people: Mentionable[]): Segment[] {
  const names = byLongestName(people.filter((p) => mentionedIds.indexOf(p.id) !== -1)).map((p) => `@${p.name}`)
  if (!names.length || !body) return [{ text: body, mention: false }]
  const out: Segment[] = []
  let plain = ""
  let i = 0
  while (i < body.length) {
    const hit = body[i] === "@" ? names.find((n) => body.startsWith(n, i) && !WORD.test(body[i + n.length] ?? " ")) : undefined
    if (hit) {
      if (plain) out.push({ text: plain, mention: false })
      plain = ""
      out.push({ text: hit, mention: true })
      i += hit.length
    } else {
      plain += body[i]
      i++
    }
  }
  if (plain) out.push({ text: plain, mention: false })
  return out
}

/** The “@word” being typed at the caret, if any — drives the suggestion list. */
export function activeMention(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret)
  const m = /(^|\s)@([A-Za-z0-9_\u0080-\uFFFF ]{0,30})$/.exec(before)
  if (!m) return null
  // a space only continues the name while it still looks like one (no double spaces)
  if (/ {2}/.test(m[2])) return null
  return { query: m[2], start: before.length - m[2].length - 1 }
}

export function suggestPeople(people: Mentionable[], query: string, limit = 6): Mentionable[] {
  const q = query.trim().toLowerCase()
  return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, limit)
}

/** Where a shared item opens in the dashboard. */
export function refHref(ref: ChatRef): string {
  if (ref.type === "ORDER") return `/orders?search=${encodeURIComponent(ref.label.replace(/^Order\s+/, ""))}`
  if (ref.type === "PRODUCT") return `/products/${ref.id}`
  return `/customers?search=${encodeURIComponent(ref.label)}`
}

export const REF_TYPE_LABEL = { ORDER: "Order", PRODUCT: "Product", CUSTOMER: "Customer" } as const

/** Messages grouped under a date heading, newest last. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" })
}

/** Consecutive messages from one person within 5 minutes read as one block. */
export function startsBlock(prev: ChatMessage | undefined, cur: ChatMessage): boolean {
  if (!prev || prev.sender_id !== cur.sender_id || dayKey(prev.created_at) !== dayKey(cur.created_at)) return true
  return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000
}

export function memberLabel(m: Pick<ChatMember, "name" | "platform_role">): string {
  return `${m.name ?? "Former staff"}${m.platform_role ? " · HQ" : ""}`
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?"
}
