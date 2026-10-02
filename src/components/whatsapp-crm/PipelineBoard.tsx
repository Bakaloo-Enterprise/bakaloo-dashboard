"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PipelineBoard as Board, PipelineCard, PipelineStage } from "@/types/whatsapp-crm.types"
import { PipelineCardView } from "./PipelineCardView"
import { cardTitle } from "./pipeline-helpers"

function DraggableCard({ card, disabled, onOpen }: { card: PipelineCard; disabled: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.contact_id, disabled })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`${cardTitle(card)} — open conversation. ${disabled ? "" : "Press space to pick up and move to another stage."}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen()
        else listeners?.onKeyDown?.(e)
      }}
      className={cn("cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing", isDragging && "opacity-40", disabled && "cursor-pointer")}
    >
      <PipelineCardView card={card} />
    </div>
  )
}

function Column({ stage, canMove, onOpen }: { stage: PipelineStage; canMove: boolean; onOpen: (c: PipelineCard) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, disabled: !canMove })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.name}, ${stage.cards.length} customers`}
      className={cn("flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30", isOver && "ring-2 ring-primary/50")}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2" style={{ borderTop: `3px solid ${stage.color}`, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
        <h3 className="truncate text-sm font-semibold">{stage.name}</h3>
        <div className="flex items-center gap-1.5">
          {!stage.is_auto && (
            <span title="Manual stage — only people move cards here, never the system" className="text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" aria-label="Manual stage" />
            </span>
          )}
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium">{stage.cards.length}</span>
        </div>
      </header>
      <div className="flex max-h-[calc(100vh-17rem)] min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {stage.cards.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No customers</p>}
        {stage.cards.map((c) => (
          <DraggableCard key={c.contact_id} card={c} disabled={!canMove} onOpen={() => onOpen(c)} />
        ))}
      </div>
    </section>
  )
}

interface Props {
  board: Board
  canMove: boolean
  onMove: (contactId: string, stageId: string) => void
}

export function PipelineBoardView({ board, canMove, onMove }: Props) {
  const router = useRouter()
  const [active, setActive] = useState<PipelineCard | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  const all = [...board.stages.flatMap((s) => s.cards), ...board.unstaged]
  const open = (c: PipelineCard) => router.push(`/whatsapp-crm/inbox?conversation=${c.conversation_id}`)

  function onDragStart(e: DragStartEvent) {
    setActive(all.find((c) => c.contact_id === e.active.id) ?? null)
  }
  function onDragEnd(e: DragEndEvent) {
    setActive(null)
    if (!e.over) return
    const card = all.find((c) => c.contact_id === e.active.id)
    const toStage = String(e.over.id)
    if (card && card.stage_id !== toStage && board.stages.some((s) => s.id === toStage)) onMove(card.contact_id, toStage)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="flex gap-3 overflow-x-auto pb-3" role="list" aria-label="Customer pipeline stages">
        {board.unstaged.length > 0 && (
          <section className="flex w-72 shrink-0 flex-col rounded-lg border border-dashed bg-muted/20" aria-label="New, not staged yet">
            <header className="border-b px-3 py-2 text-sm font-semibold">New</header>
            <div className="flex flex-col gap-2 p-2">
              {board.unstaged.map((c) => (
                <DraggableCard key={c.contact_id} card={c} disabled={!canMove} onOpen={() => open(c)} />
              ))}
            </div>
          </section>
        )}
        {board.stages.map((s) => (
          <Column key={s.id} stage={s} canMove={canMove} onOpen={open} />
        ))}
      </div>
      <DragOverlay>{active ? <PipelineCardView card={active} dragging /> : null}</DragOverlay>
    </DndContext>
  )
}
