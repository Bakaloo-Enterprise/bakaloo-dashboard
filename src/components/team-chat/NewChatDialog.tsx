"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDebounce } from "@/hooks/useDebounce"
import { useChatPeople } from "@/hooks/useTeamChat"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import type { ChatKind, NewChatInput } from "@/types/team-chat.types"

interface Props {
  open: boolean
  canManage: boolean
  saving: boolean
  onClose: () => void
  onCreate: (input: NewChatInput) => void
}

const KIND_TEXT: Record<ChatKind, { label: string; hint: string }> = {
  DM: { label: "Direct message", hint: "A private chat with one person." },
  GROUP: { label: "Group", hint: "A private chat with a few people. You are its owner." },
  CHANNEL: { label: "Channel", hint: "For a whole team or store(s). HQ managers only." },
}

/** Start a direct message, a group, or (HQ managers) a channel for a team or stores. */
export function NewChatDialog({ open, canManage, saving, onClose, onCreate }: Props) {
  const [kind, setKind] = useState<ChatKind>("DM")
  const [search, setSearch] = useState("")
  const [name, setName] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [hq, setHq] = useState(false)
  const [shopIds, setShopIds] = useState<string[]>([])
  const dq = useDebounce(search, 250)
  const people = useChatPeople(dq, open)
  const shops = useActiveShopsForSwitcher()
  const shopList = (shops.data?.items ?? []).filter((s) => s.id && s.name)

  useEffect(() => { if (open) { setKind("DM"); setSearch(""); setName(""); setPicked([]); setHq(false); setShopIds([]) } }, [open])

  const toggle = (id: string) => setPicked((cur) => (kind === "DM" ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 99 ? cur : [...cur, id]))
  const toggleShop = (id: string) => setShopIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const hasAudience = hq || shopIds.length > 0
  const valid =
    kind === "DM" ? picked.length === 1
    : kind === "GROUP" ? name.trim().length >= 2 && picked.length >= 1
    : name.trim().length >= 2 && (picked.length >= 1 || hasAudience)

  const submit = () => {
    if (kind === "DM") onCreate({ kind, userId: picked[0] })
    else if (kind === "GROUP") onCreate({ kind, name: name.trim(), memberIds: picked })
    else onCreate({ kind, name: name.trim(), memberIds: picked, ...(hasAudience ? { audience: { hq, shopIds } } : {}) })
  }
  const kinds: ChatKind[] = canManage ? ["DM", "GROUP", "CHANNEL"] : ["DM", "GROUP"]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>{KIND_TEXT[kind].hint} Chats are internal — customers never see them.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1" role="tablist" aria-label="Kind of chat">
          {kinds.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setPicked((p) => (k === "DM" ? p.slice(0, 1) : p)) }} className={`rounded-full border px-3 py-1 text-xs ${kind === k ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>
              {KIND_TEXT[k].label}
            </button>
          ))}
        </div>

        {kind !== "DM" && (
          <div>
            <Label htmlFor="chat-name">{kind === "GROUP" ? "Group name" : "Channel name"}</Label>
            <Input id="chat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={kind === "GROUP" ? "e.g. Store 1 pickers" : "e.g. HQ ↔ Salt Lake store"} className="mt-1" />
          </div>
        )}

        {kind === "CHANNEL" && (
          <fieldset className="space-y-1 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium">Add whole teams (optional)</legend>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hq} onChange={(e) => setHq(e.target.checked)} /> All HQ staff</label>
            {shopList.length > 0 && <p className="pt-1 text-xs text-muted-foreground">Everyone working at:</p>}
            <div className="max-h-28 overflow-y-auto">
              {shopList.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" checked={shopIds.includes(s.id)} onChange={() => toggleShop(s.id)} /> {s.name}</label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Picks everyone who is there now. Use “Refresh people” later to add new joiners.</p>
          </fieldset>
        )}

        <div>
          <Label htmlFor="chat-search">{kind === "DM" ? "Who do you want to message?" : kind === "GROUP" ? "Add people" : "Add individual people (optional)"}</Label>
          <Input id="chat-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="mt-1" />
          <ul className="mt-2 max-h-48 divide-y overflow-y-auto rounded-md border text-sm" aria-label="People">
            {people.data?.length === 0 && <li className="p-2 text-xs text-muted-foreground">No one found.</li>}
            {(people.data ?? []).map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-muted/50">
                  <input type={kind === "DM" ? "radio" : "checkbox"} name="chat-person" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
                  <span className="flex-1">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.platform_role ? "HQ" : p.shops.join(", ")}</span>
                </label>
              </li>
            ))}
          </ul>
          {kind !== "DM" && <p className="mt-1 text-xs text-muted-foreground">{picked.length} selected</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || saving} onClick={submit}>{saving ? "Creating…" : kind === "DM" ? "Open chat" : `Create ${kind === "GROUP" ? "group" : "channel"}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
