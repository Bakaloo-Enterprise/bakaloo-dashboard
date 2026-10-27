import type { QueryClient, QueryKey } from "@tanstack/react-query"

/**
 * WhatsApp CRM events can arrive many times a second (a broadcast's delivery receipts and replies). Invalidating
 * on every event cancels the inbox request that is already in flight and starts it again, so a freshly chosen
 * filter or page never finishes loading and the list looks frozen. This batches the keys and refetches at most
 * once per `waitMs`, and never cancels a request that is already running.
 */
export function createCrmRefresher(getClient: () => QueryClient, waitMs = 1000) {
  const pending = new Map<string, QueryKey>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    timer = null
    const keys = Array.from(pending.values())
    pending.clear()
    const qc = getClient()
    for (const queryKey of keys) qc.invalidateQueries({ queryKey }, { cancelRefetch: false })
  }

  return {
    invalidate(...keys: QueryKey[]) {
      for (const k of keys) pending.set(JSON.stringify(k), k)
      if (!timer) timer = setTimeout(flush, waitMs)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      pending.clear()
    },
  }
}
