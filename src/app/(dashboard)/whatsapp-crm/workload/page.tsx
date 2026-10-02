"use client"

import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useCrmMe, useWorkload } from "@/hooks/useWhatsappCrm"

export default function WorkloadPage() {
  const me = useCrmMe()
  const allowed = me.can("crm.workload.view")
  const w = useWorkload(allowed)

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!allowed) return <Forbidden />

  const agents = w.data?.agents ?? []
  const un = w.data?.unassigned
  return (
    <div className="space-y-4">
      <PageHeader title="Agent Workload" subtitle="Who is handling how many WhatsApp conversations right now" />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Active chats</TableHead>
              <TableHead className="text-right">Unread</TableHead>
              <TableHead className="text-right">Waiting for reply</TableHead>
              <TableHead className="text-right">Waiting &gt; 15 min</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {w.isLoading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}
            {agents.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-right">{a.active}</TableCell>
                <TableCell className="text-right">{a.unread}</TableCell>
                <TableCell className="text-right">{a.awaiting_reply}</TableCell>
                <TableCell className={cn("text-right", a.waiting_over_15m > 0 && "font-semibold text-red-600")}>{a.waiting_over_15m}</TableCell>
              </TableRow>
            ))}
            {un && (
              <TableRow className="bg-muted/40">
                <TableCell className="font-medium italic">Unassigned</TableCell>
                <TableCell className="text-right">{un.active}</TableCell>
                <TableCell className="text-right">{un.unread}</TableCell>
                <TableCell className="text-right">{un.awaiting_reply}</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        To move chats between agents, select them in the Inbox and use “Assign to…”. Resolved chats are not counted.
      </p>
    </div>
  )
}
