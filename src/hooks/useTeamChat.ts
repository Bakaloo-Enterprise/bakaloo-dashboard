"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { qk } from "@/lib/query-keys"
import {
  addChatMembers,
  createChatChannel,
  deleteChatMessage,
  getChatChannel,
  getChatChannels,
  getChatMe,
  getChatMessages,
  getChatPeople,
  getChatUnread,
  markChatRead,
  refreshChatAudience,
  removeChatMember,
  searchChatRefs,
  sendChatMessage,
  setChatArchived,
  updateChatChannel,
} from "@/services/team-chat.service"
import type { ChatRefType, NewChatInput } from "@/types/team-chat.types"

function messageOf(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string }
  return e?.response?.data?.message ?? e?.message ?? "Something went wrong"
}

export function useChatMe() {
  return useQuery({ queryKey: qk.chatMe(), queryFn: getChatMe, staleTime: 5 * 60_000, retry: false })
}

/** Sidebar badge. Realtime events refresh it; the slow poll is only a safety net. */
export function useChatUnread(enabled = true) {
  return useQuery({ queryKey: qk.chatUnread(), queryFn: getChatUnread, enabled, staleTime: 15_000, refetchInterval: 120_000, retry: false })
}

export function useChatPeople(search: string, enabled = true) {
  return useQuery({ queryKey: qk.chatPeople(search), queryFn: () => getChatPeople(search || undefined), enabled, staleTime: 30_000 })
}

export function useChatChannels(archived = false) {
  return useQuery({ queryKey: qk.chatChannels(archived), queryFn: () => getChatChannels(archived), placeholderData: (prev) => prev })
}

export function useChatChannel(id: string | null) {
  return useQuery({ queryKey: qk.chatChannel(id ?? ""), queryFn: () => getChatChannel(id as string), enabled: Boolean(id), retry: false })
}

export function useChatMessages(id: string | null) {
  return useQuery({ queryKey: qk.chatMessages(id ?? ""), queryFn: () => getChatMessages(id as string, { limit: 100 }), enabled: Boolean(id), retry: false })
}

export function useChatRefSearch(type: ChatRefType, q: string, enabled = true) {
  return useQuery({ queryKey: qk.chatRefs(type, q), queryFn: () => searchChatRefs(type, q), enabled: enabled && q.trim().length >= 2, staleTime: 15_000 })
}

export function useChatMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["chat"] })
  const fail = (err: unknown) => toast.error(messageOf(err))
  return {
    create: useMutation({ mutationFn: (i: NewChatInput) => createChatChannel(i), onError: fail, onSettled: refresh }),
    update: useMutation({ mutationFn: ({ id, ...i }: { id: string; name?: string; description?: string }) => updateChatChannel(id, i), onError: fail, onSettled: refresh }),
    addMembers: useMutation({ mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) => addChatMembers(id, userIds), onError: fail, onSettled: refresh }),
    removeMember: useMutation({ mutationFn: ({ id, userId }: { id: string; userId: string }) => removeChatMember(id, userId), onError: fail, onSettled: refresh }),
    archive: useMutation({ mutationFn: ({ id, archived }: { id: string; archived: boolean }) => setChatArchived(id, archived), onError: fail, onSettled: refresh }),
    refreshAudience: useMutation({
      mutationFn: (id: string) => refreshChatAudience(id),
      onSuccess: (r) => toast.success(r.added ? `Added ${r.added} ${r.added === 1 ? "person" : "people"}` : "Everyone is already in"),
      onError: fail,
      onSettled: refresh,
    }),
    send: useMutation({
      mutationFn: ({ id, ...input }: { id: string; body: string; mentions?: string[]; ref?: { type: ChatRefType; id: string } }) => sendChatMessage(id, input),
      onError: fail,
      onSettled: refresh,
    }),
    remove: useMutation({ mutationFn: ({ id, messageId }: { id: string; messageId: string }) => deleteChatMessage(id, messageId), onError: fail, onSettled: refresh }),
    markRead: useMutation({ mutationFn: (id: string) => markChatRead(id), onSettled: () => { qc.invalidateQueries({ queryKey: ["chat", "channels"] }); qc.invalidateQueries({ queryKey: qk.chatUnread() }) } }),
  }
}
