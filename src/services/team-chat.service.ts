import api from "@/lib/api"
import type { ApiResponse } from "@/types/api.types"
import type { ChatChannel, ChatMe, ChatMessage, ChatPerson, ChatRefResult, ChatRefType, ChatUnread, NewChatInput } from "@/types/team-chat.types"

const BASE = "/admin/chat"

export async function getChatMe() {
  const { data } = await api.get<ApiResponse<ChatMe>>(`${BASE}/me`)
  return data.data
}
export async function getChatPeople(search?: string) {
  const { data } = await api.get<ApiResponse<ChatPerson[]>>(`${BASE}/people`, { params: search ? { search } : {} })
  return data.data
}
export async function getChatUnread() {
  const { data } = await api.get<ApiResponse<ChatUnread>>(`${BASE}/unread`)
  return data.data
}
export async function getChatChannels(archived = false) {
  const { data } = await api.get<ApiResponse<ChatChannel[]>>(`${BASE}/channels`, { params: { archived } })
  return data.data
}
export async function getChatChannel(id: string) {
  const { data } = await api.get<ApiResponse<ChatChannel>>(`${BASE}/channels/${id}`)
  return data.data
}
export async function createChatChannel(input: NewChatInput) {
  const { data } = await api.post<ApiResponse<ChatChannel>>(`${BASE}/channels`, input)
  return data.data
}
export async function updateChatChannel(id: string, input: { name?: string; description?: string }) {
  const { data } = await api.patch<ApiResponse<ChatChannel>>(`${BASE}/channels/${id}`, input)
  return data.data
}
export async function addChatMembers(id: string, userIds: string[]) {
  const { data } = await api.post<ApiResponse<ChatChannel>>(`${BASE}/channels/${id}/members`, { userIds })
  return data.data
}
export async function removeChatMember(id: string, userId: string) {
  await api.delete(`${BASE}/channels/${id}/members/${userId}`)
}
export async function setChatArchived(id: string, archived: boolean) {
  const { data } = await api.post<ApiResponse<ChatChannel>>(`${BASE}/channels/${id}/${archived ? "archive" : "unarchive"}`, {})
  return data.data
}
export async function refreshChatAudience(id: string) {
  const { data } = await api.post<ApiResponse<{ added: number }>>(`${BASE}/channels/${id}/refresh-audience`, {})
  return data.data
}
export async function getChatMessages(id: string, params: { before?: number; limit?: number } = {}) {
  const { data } = await api.get<ApiResponse<ChatMessage[]>>(`${BASE}/channels/${id}/messages`, { params })
  return data.data
}
export async function sendChatMessage(id: string, input: { body: string; mentions?: string[]; ref?: { type: ChatRefType; id: string } }) {
  const { data } = await api.post<ApiResponse<ChatMessage>>(`${BASE}/channels/${id}/messages`, input)
  return data.data
}
export async function deleteChatMessage(id: string, messageId: string) {
  await api.delete(`${BASE}/channels/${id}/messages/${messageId}`)
}
export async function markChatRead(id: string) {
  await api.post(`${BASE}/channels/${id}/read`, {})
}
export async function searchChatRefs(type: ChatRefType, q: string) {
  const { data } = await api.get<ApiResponse<ChatRefResult[]>>(`${BASE}/refs`, { params: { type, q } })
  return data.data
}
