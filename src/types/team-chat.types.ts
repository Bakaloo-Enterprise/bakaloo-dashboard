export type ChatKind = "DM" | "GROUP" | "CHANNEL"
export type ChatRefType = "ORDER" | "PRODUCT" | "CUSTOMER"

export interface ChatAbilities {
  send: boolean
  rename: boolean
  manageMembers: boolean
  leave: boolean
  archive: boolean
  unarchive: boolean
  refreshAudience: boolean
}
export interface ChatMe {
  userId: string
  name: string | null
  canManage: boolean
  isHq: boolean
}
export interface ChatPerson {
  id: string
  name: string
  platform_role: string | null
  shops: string[]
}
export interface ChatMember {
  user_id: string
  role: "OWNER" | "MEMBER"
  name: string | null
  is_active: boolean
  platform_role: string | null
}
export interface ChatChannel {
  id: string
  kind: ChatKind
  name: string
  description: string | null
  archived: boolean
  last_message_at: string | null
  created_at: string
  my_role: "OWNER" | "MEMBER"
  member_count: number
  unread?: number
  unread_mentions?: number
  preview?: string
  peer?: { id: string; name: string; active: boolean } | null
  members?: ChatMember[]
  abilities: ChatAbilities
}
export interface ChatRef {
  type: ChatRefType
  id: string
  label: string
}
export interface ChatMessage {
  id: string
  seq: number
  channel_id: string
  sender_id: string | null
  sender_name: string
  body: string
  ref: ChatRef | null
  mentions: string[]
  deleted: boolean
  created_at: string
}
export interface ChatRefResult {
  id: string
  type: ChatRefType
  label: string
  hint?: string | null
}
export interface ChatUnread {
  unread: number
  mentions: number
}
export type NewChatInput =
  | { kind: "DM"; userId: string }
  | { kind: "GROUP"; name: string; memberIds: string[]; description?: string }
  | { kind: "CHANNEL"; name: string; memberIds?: string[]; description?: string; audience?: { hq?: boolean; shopIds?: string[] } }
