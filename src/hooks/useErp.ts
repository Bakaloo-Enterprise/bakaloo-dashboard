"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as S from "@/services/erp.service"
import { bizError } from "@/hooks/useBusiness"
import type { PeriodQuery } from "@/types/business.types"

export const useDayClose = (p: { date?: string; shopId?: string }, enabled = true) =>
  useQuery({ queryKey: ["erp", "day-close", p], queryFn: () => S.getDayClose(p), enabled, placeholderData: (prev) => prev, refetchInterval: 60_000 })

export const useWastage = (p: PeriodQuery & { shopId?: string }, enabled = true) =>
  useQuery({ queryKey: ["erp", "wastage", p], queryFn: () => S.getWastage(p), enabled, placeholderData: (prev) => prev })

export const useForecast = (p: { shopId?: string; horizon?: number; cover?: number }, enabled = true) =>
  useQuery({ queryKey: ["erp", "forecast", p], queryFn: () => S.getForecast(p), enabled, placeholderData: (prev) => prev, refetchInterval: 5 * 60_000 })

export function useSaveTargets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { productId: string; marginPct: number | null; wastagePct: number | null }) => S.saveTargets(v.productId, { marginPct: v.marginPct, wastagePct: v.wastagePct }),
    onError: (e) => toast.error(bizError(e)),
    onSuccess: () => { toast.success("Targets saved"); qc.invalidateQueries({ queryKey: ["erp"] }) },
  })
}

// ── Accounting ──
export const useAccountingSummary = (month: string) => useQuery({ queryKey: ["erp", "acc-summary", month], queryFn: () => S.getAccountingSummary(month), placeholderData: (p) => p })
export const useJournal = (month: string, enabled = true) => useQuery({ queryKey: ["erp", "acc-journal", month], queryFn: () => S.getJournal(month), enabled, placeholderData: (p) => p })
export const useExpenses = (p: { from?: string; to?: string; category?: string; shopId?: string; includeVoided?: boolean }) => useQuery({ queryKey: ["erp", "acc-expenses", p], queryFn: () => S.getExpenses(p), placeholderData: (prev) => prev })
export const useCashEntries = (p: { from?: string; to?: string; includeVoided?: boolean }) => useQuery({ queryKey: ["erp", "acc-cash", p], queryFn: () => S.getCashEntries(p), placeholderData: (prev) => prev })

/** Every accounting change moves the month's profit and balances, so each success re-reads all of "erp". */
export function useAccountingMutations() {
  const qc = useQueryClient()
  const base = { onError: (e: unknown) => toast.error(bizError(e)) }
  const done = (msg: string) => () => { toast.success(msg); qc.invalidateQueries({ queryKey: ["erp"] }) }
  return {
    createExpense: useMutation({ mutationFn: S.createExpense, ...base, onSuccess: done("Expense saved") }),
    voidExpense: useMutation({ mutationFn: (v: { id: string; reason: string }) => S.voidExpense(v.id, v.reason), ...base, onSuccess: done("Expense cancelled") }),
    createCash: useMutation({ mutationFn: S.createCashEntry, ...base, onSuccess: done("Entry saved") }),
    voidCash: useMutation({ mutationFn: (v: { id: string; reason: string }) => S.voidCashEntry(v.id, v.reason), ...base, onSuccess: done("Entry cancelled") }),
  }
}

// ── Data Explorer ──
import type { ExplorerKind } from "@/types/erp.types"
export const useExplorer = (kind: ExplorerKind, p: S.ExplorerParams, enabled = true) =>
  useQuery({ queryKey: ["erp", "explorer", kind, p], queryFn: () => S.getExplorer(kind, p), enabled, placeholderData: (prev) => prev })

export const useFounder = (month: string) => useQuery({ queryKey: ["erp", "founder", month], queryFn: () => S.getFounder(month), placeholderData: (p) => p, staleTime: 60_000 })

export const useShelf = (shopId: string) => useQuery({ queryKey: ["erp", "shelf", shopId], queryFn: () => S.getShelf(shopId), enabled: Boolean(shopId), staleTime: 15_000 })
export function useLogWastage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: S.logWastage,
    onError: (e) => toast.error(bizError(e)),
    onSuccess: (r) => { toast.success(`Removed ${r.removed} × ${r.product} — ${r.left} left on the shelf`); qc.invalidateQueries({ queryKey: ["erp"] }) },
  })
}
