"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getDeveloperOverview,
  getFeatureAccess,
  grantFeature,
  revokeFeature,
  searchDeveloperUsers,
  setDeveloper,
  setFeatureReleased,
  type FeatureKey,
} from "@/services/features.service"
import { useAuthStore } from "@/store/auth.store"

const FEATURES_KEY = ["features"] as const

/** Which in-development features are locked for the signed-in user. Fails CLOSED: no answer = locked. */
export function useFeatures() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: FEATURES_KEY,
    queryFn: getFeatureAccess,
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: 1,
  })
}

export function useFeatureAccess(key: FeatureKey) {
  const q = useFeatures()
  return {
    isLoading: q.isLoading,
    canAccess: q.data?.features?.[key]?.canAccess === true,
    isDeveloper: q.data?.isDeveloper === true,
    label: q.data?.features?.[key]?.label ?? "This feature",
  }
}

/** The feature a dashboard path belongs to, or null for everything that is not locked. */
export function featureForPath(path: string): FeatureKey | null {
  if (path === "/whatsapp-crm/chat" || path.startsWith("/whatsapp-crm/chat/")) return "team_chat"
  if (path === "/whatsapp-crm" || path.startsWith("/whatsapp-crm/")) return "whatsapp_crm"
  if (path === "/procurement" || path.startsWith("/procurement/")) return "procurement"
  if (path === "/catalog-bulk" || path.startsWith("/catalog-bulk/")) return "catalog_bulk"
  if (path === "/business-analytics" || path.startsWith("/business-analytics/")) return "business_analytics"
  if (path === "/pos" || path.startsWith("/pos/")) return "store_pos"
  return null
}

function errMsg(e: unknown) {
  const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
  return m || "Something went wrong"
}

export function useDeveloperOverview() {
  return useQuery({ queryKey: ["developer", "overview"], queryFn: getDeveloperOverview, staleTime: 5_000 })
}

export function useDeveloperUsers(search: string, enabled = true) {
  return useQuery({ queryKey: ["developer", "users", search], queryFn: () => searchDeveloperUsers(search), enabled, staleTime: 10_000 })
}

function useDeveloperMutation<T>(fn: (v: T) => Promise<void>, ok: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(ok)
      qc.invalidateQueries({ queryKey: ["developer"] })
      qc.invalidateQueries({ queryKey: FEATURES_KEY })
    },
    onError: (e) => toast.error(errMsg(e)),
  })
}

export const useSetReleased = () =>
  useDeveloperMutation(({ key, released }: { key: string; released: boolean }) => setFeatureReleased(key, released), "Saved")
export const useGrantFeature = () =>
  useDeveloperMutation(({ key, userId }: { key: string; userId: string }) => grantFeature(key, userId), "Access granted")
export const useRevokeFeature = () =>
  useDeveloperMutation(({ key, userId }: { key: string; userId: string }) => revokeFeature(key, userId), "Access removed")
export const useSetDeveloper = () =>
  useDeveloperMutation(({ userId, isDeveloper }: { userId: string; isDeveloper: boolean }) => setDeveloper(userId, isDeveloper), "Saved")
