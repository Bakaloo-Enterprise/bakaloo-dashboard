"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDebounce } from "@/hooks/useDebounce"
import { useChatMutations, useChatPeople } from "@/hooks/useTeamChat"
import type { ChatChannel } from "@/types/team-chat.types"
import { memberLabel } from "./chat-helpers"

/** Members, rename, leave, archive. Each control appears only if the server says you may use it. */
export function ChannelSettings({ channel, meId, open, onClose, onGone }: { channel: ChatChannel; meId: string; open: boolean; onClose: () => void; onGone: () => void }) {
  const m = useChatMutations()
  const [name, setName] = useState(channel.name)
  const [search, setSearch] = useState("")
  const dq = useDebounce(search, 250)
  const ab = channel.abilities
  const members = channel.members ?? []
  const memberIds = new Set(members.map((x) => x.user_id))
  const people = useChatPeople(dq, open && ab.manageMembers)
  const candidates = (people.data ?? []).filter((p) => !memberIds.has(p.id))

  useEffect(() => { if (open) { setName(channel.name); setSearch("") } }, [open, channel.name])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{channel.name}</DialogTitle>
          <DialogDescription>{channel.kind === "DM" ? "Direct messages are between the two of you only." : `${members.length} people`}</DialogDescription>
        </DialogHeader>

        {ab.rename && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="rename" className="text-xs">Name</Label>
              <Input id="rename" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <Button size="sm" disabled={name.trim().length < 2 || name.trim() === channel.name || m.update.isPending} onClick={() => m.update.mutate({ id: channel.id, name: name.trim() })}>Save</Button>
          </div>
        )}

        <section aria-label="Members">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">People</h3>
          <ul className="mt-1 divide-y rounded-md border text-sm">
            {members.map((x) => (
              <li key={x.user_id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="min-w-0 truncate">
                  {memberLabel(x)}{x.user_id === meId && " (you)"}
                  {x.role === "OWNER" && <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px] font-semibold">Owner</span>}
                  {!x.is_active && <span className="ml-2 text-[10px] text-amber-700">no longer active</span>}
                </span>
                {ab.manageMembers && x.user_id !== meId && (
                  <Button variant="ghost" size="sm" disabled={m.removeMember.isPending} onClick={() => m.removeMember.mutate({ id: channel.id, userId: x.user_id })}>Remove</Button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {ab.manageMembers && (
          <section aria-label="Add people">
            <Label htmlFor="add-people" className="text-xs">Add people</Label>
            <Input id="add-people" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="mt-1" />
            <ul className="mt-1 max-h-36 divide-y overflow-y-auto rounded-md border text-sm">
              {candidates.length === 0 && <li className="p-2 text-xs text-muted-foreground">No one to add.</li>}
              {candidates.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-2 py-1.5">
                  <span>{p.name} <span className="text-xs text-muted-foreground">{p.platform_role ? "HQ" : p.shops.join(", ")}</span></span>
                  <Button variant="outline" size="sm" disabled={m.addMembers.isPending} onClick={() => m.addMembers.mutate({ id: channel.id, userIds: [p.id] })}>Add</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          {ab.refreshAudience && <Button variant="outline" size="sm" disabled={m.refreshAudience.isPending} onClick={() => m.refreshAudience.mutate(channel.id)}>Refresh people</Button>}
          {ab.leave && <Button variant="outline" size="sm" onClick={() => m.removeMember.mutate({ id: channel.id, userId: meId }, { onSuccess: () => { onClose(); onGone() } })}>Leave chat</Button>}
          {ab.archive && <Button variant="outline" size="sm" onClick={() => m.archive.mutate({ id: channel.id, archived: true }, { onSuccess: () => { onClose(); onGone() } })}>Archive</Button>}
          {ab.unarchive && <Button variant="outline" size="sm" onClick={() => m.archive.mutate({ id: channel.id, archived: false }, { onSuccess: onClose })}>Restore</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
