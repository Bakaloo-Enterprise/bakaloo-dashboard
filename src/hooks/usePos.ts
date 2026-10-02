"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  addPrinter, assignPerson, assignRiderToOrder, claimJob, confirmLine, decideMissing, finishPack, finishPick, getAttention, getBoard, getDocument, getJobs, getOrder,
  getPerformance, getPosMe, getPrinters, getRiders, getStaff, getTimeline, handover, heartbeat, removePrinter, reportJob, reportMissing, reprintJob, resolveAttention, retryJob,
  scan, setStation, startPack, startPick, testPrint, updatePrinter,
} from "@/services/pos.service"
import type { PosStation, Stage } from "@/types/pos.types"

export function posErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string }
  return e?.response?.data?.message ?? e?.message ?? "Something went wrong"
}
export function posErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { code?: string } } })?.response?.data?.code
}

// Realtime events ("pos:update") refresh these; the interval is only a safety net for a dropped connection.
export function usePosMe() {
  return useQuery({ queryKey: ["pos", "me"], queryFn: getPosMe, staleTime: 5 * 60_000, retry: false })
}
export function useBoard(enabled = true) {
  return useQuery({ queryKey: ["pos", "board"], queryFn: getBoard, enabled, refetchInterval: 30_000, placeholderData: (p) => p })
}
export function usePosOrder(id: string | null) {
  return useQuery({ queryKey: ["pos", "order", id], queryFn: () => getOrder(id as string), enabled: Boolean(id), retry: false, refetchInterval: 30_000 })
}
export function useTimeline(id: string | null) {
  return useQuery({ queryKey: ["pos", "timeline", id], queryFn: () => getTimeline(id as string), enabled: Boolean(id) })
}
export function useRiders(enabled = true) {
  return useQuery({ queryKey: ["pos", "riders"], queryFn: getRiders, enabled, refetchInterval: 30_000 })
}
export function usePrinters(enabled = true) {
  return useQuery({ queryKey: ["pos", "printers"], queryFn: getPrinters, enabled, refetchInterval: 30_000 })
}
export function useStaff(enabled = true) {
  return useQuery({ queryKey: ["pos", "staff"], queryFn: getStaff, enabled })
}
export function useJobs(params: { status?: string; printerId?: string; limit?: number } = {}, enabled = true, interval: number | false = 15_000) {
  return useQuery({ queryKey: ["pos", "jobs", params], queryFn: () => getJobs(params), enabled, refetchInterval: interval })
}
export function useAttention(enabled = true) {
  return useQuery({ queryKey: ["pos", "attention"], queryFn: getAttention, enabled, refetchInterval: 30_000 })
}
export function usePerformance(params: { from?: string; to?: string }, enabled = true) {
  return useQuery({ queryKey: ["pos", "performance", params], queryFn: () => getPerformance(params), enabled, staleTime: 60_000, placeholderData: (p) => p })
}

/** Every mutation re-reads the POS data it may have changed. Errors become a toast unless the caller handles them. */
export function usePosMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["pos"] })
  const fail = (err: unknown) => toast.error(posErrorMessage(err))
  const base = { onError: fail, onSettled: refresh }
  return {
    assignPerson: useMutation({ mutationFn: (v: { id: string; role: "PICKER" | "PACKER"; userId: string }) => assignPerson(v.id, v.role, v.userId), ...base }),
    startPick: useMutation({ mutationFn: (id: string) => startPick(id), ...base }),
    // A wrong scan is part of the job, not an unexpected error: the screen shows it in place, so no generic toast.
    scan: useMutation({ mutationFn: (v: { id: string; stage: Stage; code: string }) => scan(v.id, v.stage, v.code), onSettled: refresh }),
    confirmLine: useMutation({ mutationFn: (v: { id: string; lineId: string; stage: Stage; qty?: number }) => confirmLine(v.id, v.lineId, v.stage, v.qty), ...base }),
    reportMissing: useMutation({ mutationFn: (v: { id: string; lineId: string; note: string }) => reportMissing(v.id, v.lineId, v.note), ...base }),
    decideMissing: useMutation({ mutationFn: (v: { id: string; lineId: string; decision: "REPLACE" | "REMOVE" | "REFUND"; note: string }) => decideMissing(v.id, v.lineId, v.decision, v.note), ...base }),
    finishPick: useMutation({ mutationFn: (id: string) => finishPick(id), ...base }),
    startPack: useMutation({ mutationFn: (id: string) => startPack(id), ...base }),
    finishPack: useMutation({ mutationFn: (v: { id: string; packages: number }) => finishPack(v.id, v.packages), ...base }),
    assignRider: useMutation({ mutationFn: (v: { id: string; riderId: string }) => assignRiderToOrder(v.id, v.riderId), ...base }),
    handover: useMutation({ mutationFn: (id: string) => handover(id), ...base }),
    setStation: useMutation({ mutationFn: (v: { userId: string; station: PosStation | null }) => setStation(v.userId, v.station), ...base }),
    addPrinter: useMutation({ mutationFn: (v: { name: string; paperMm: number; isDefault: boolean }) => addPrinter(v), ...base }),
    updatePrinter: useMutation({ mutationFn: (v: { id: string; name?: string; paperMm?: number; isDefault?: boolean }) => updatePrinter(v.id, v), ...base }),
    removePrinter: useMutation({ mutationFn: (id: string) => removePrinter(id), ...base }),
    testPrint: useMutation({ mutationFn: (id: string) => testPrint(id), onSuccess: () => toast.success("Test page queued"), ...base }),
    retryJob: useMutation({ mutationFn: (id: string) => retryJob(id), ...base }),
    reprintJob: useMutation({ mutationFn: (id: string) => reprintJob(id), onSuccess: () => toast.success("Reprint queued"), ...base }),
    resolve: useMutation({ mutationFn: (v: { orderId: string; kind: string; ref?: string; note?: string }) => resolveAttention(v), ...base }),
  }
}

/** For the print station: claim → fetch the document → (the page prints it) → report the result. */
export const printStationApi = { claimJob, getDocument, reportJob, heartbeat }
