import api from "@/lib/api"
import type { ApiResponse } from "@/types"

export type FeatureKey =
  | "whatsapp_crm"
  | "team_chat"
  | "procurement"
  | "catalog_bulk"
  | "store_pos"
  | "business_analytics"

export interface FeatureState {
  label: string
  released: boolean
  canAccess: boolean
}

export interface FeatureAccess {
  isDeveloper: boolean
  features: Record<string, FeatureState>
}

export interface DeveloperFeature {
  key: FeatureKey
  label: string
  description: string | null
  released: boolean
  released_at: string | null
  grants: { userId: string; fullName: string | null; email: string | null }[]
}

export interface DeveloperPerson {
  id: string
  full_name: string | null
  email: string | null
  platform_role: string | null
  is_developer?: boolean
}

export interface DeveloperOverview {
  features: DeveloperFeature[]
  developers: DeveloperPerson[]
}

/** Which features are locked for the signed-in user (and whether they are a Developer Super Admin). */
export async function getFeatureAccess(): Promise<FeatureAccess> {
  const { data } = await api.get<ApiResponse<FeatureAccess>>("/admin/features")
  return data.data
}

export async function getDeveloperOverview(): Promise<DeveloperOverview> {
  const { data } = await api.get<ApiResponse<DeveloperOverview>>("/admin/developer/overview")
  return data.data
}

export async function searchDeveloperUsers(search: string): Promise<DeveloperPerson[]> {
  const { data } = await api.get<ApiResponse<DeveloperPerson[]>>("/admin/developer/users", { params: { search } })
  return data.data
}

export async function setFeatureReleased(key: string, released: boolean) {
  await api.put(`/admin/developer/features/${key}`, { released })
}

export async function grantFeature(key: string, userId: string) {
  await api.put(`/admin/developer/features/${key}/grants/${userId}`)
}

export async function revokeFeature(key: string, userId: string) {
  await api.delete(`/admin/developer/features/${key}/grants/${userId}`)
}

export async function setDeveloper(userId: string, isDeveloper: boolean) {
  await api.put(`/admin/developer/users/${userId}/developer`, { isDeveloper })
}
