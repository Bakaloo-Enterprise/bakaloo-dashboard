"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { clearWaSettings, enableWaSettings, getWaSettings, saveWaSettings, testWaSettings } from "@/services/whatsapp-crm.service"
import type { WaSettingsInput, WaTestResult } from "@/types/whatsapp-settings.types"

/** Per-field messages the server sends with a 400 (“details”), if any. */
export function fieldErrors(err: unknown): Record<string, string> {
  return (err as { response?: { data?: { details?: Record<string, string> } } })?.response?.data?.details ?? {}
}
export function settingsErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string }
  return e?.response?.data?.message ?? e?.message ?? "Something went wrong"
}

export function useWaSettings(enabled = true) {
  return useQuery({ queryKey: ["crm", "settings"], queryFn: getWaSettings, enabled, staleTime: 10_000, retry: false })
}

/** Saving or testing changes what every other WhatsApp screen sees, so each re-reads status + settings. */
export function useWaSettingsMutations() {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["crm", "settings"] })
    qc.invalidateQueries({ queryKey: ["crm", "status"] })
  }
  return {
    save: useMutation({ mutationFn: (v: WaSettingsInput) => saveWaSettings(v), onSuccess: refresh }),
    test: useMutation({ mutationFn: (sendTo?: string) => testWaSettings(sendTo), onSuccess: refresh, onError: (e) => toast.error(settingsErrorMessage(e)) }),
    enable: useMutation({ mutationFn: (on: boolean) => enableWaSettings(on), onSuccess: () => { refresh(); toast.success("Saved") }, onError: (e) => toast.error(settingsErrorMessage(e)) }),
    clear: useMutation({ mutationFn: () => clearWaSettings(), onSuccess: () => { refresh(); toast.success("Saved WhatsApp details removed") }, onError: (e) => toast.error(settingsErrorMessage(e)) }),
  }
}
export type { WaTestResult }
