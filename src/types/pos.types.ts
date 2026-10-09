import type { OrderBill } from "@/types/order.types"
export type LaneId = "NEW" | "PICKING" | "PACKING" | "READY" | "WAITING_RIDER" | "PICKED_UP" | "OUT_FOR_DELIVERY"
export type Stage = "PICK" | "PACK"
export type PosStation = "PICKER" | "PACKER"

export interface PosAbilities {
  view: boolean
  pick: boolean
  pack: boolean
  handover: boolean
  reprint: boolean
  manage: boolean
}
export interface PosMe {
  userId: string
  shopId: string
  name: string
  shopRole: string | null
  station: PosStation | null
  isHq: boolean
  abilities: PosAbilities
}
export interface BoardCard {
  id: string
  orderNumber: string
  lane: LaneId
  since: string | null
  waitingMinutes: number | null
  late: boolean
  items: { lines: number; units: number }
  picker: { id: string; name: string | null } | null
  packer: { id: string; name: string | null } | null
  rider: { name: string; assignment: string; pickup: string | null } | null
  area: string
  slot: string | null
  packages: number
  progress: { done: number; total: number } | null
  flags: { missing: boolean; printFailed: boolean; paymentFailed: boolean }
}
export interface Board {
  lanes: Array<{ id: LaneId; label: string; orders: BoardCard[] }>
  deliveredLast24h: number
  printing: { printers: number; online: number; queued: number; failed: number }
  totals: { active: number; late: number }
}
export type LineStatus = "PENDING" | "PICKED" | "MISSING" | "RESOLVED"
export interface PosLine {
  id: string
  name: string
  unit: string | null
  imageUrl: string | null
  barcode: string | null
  sku: string | null
  required: number
  picked: number
  packed: number
  packTarget: number | null
  status: LineStatus
  missingNote: string | null
  decision: "REPLACE" | "REMOVE" | "REFUND" | null
  decisionNote: string | null
}
export interface Blocker {
  lineId: string
  name: string
  reason: string
  needed: number
}
export interface PrintJob {
  id: string
  kind: "INVOICE" | "LABEL" | "TEST"
  status: "QUEUED" | "PRINTING" | "PRINTED" | "FAILED" | "CANCELLED"
  orderId: string | null
  orderNumber: string | null
  printerId: string | null
  printerName: string | null
  packageNo: number | null
  packageTotal: number | null
  attempts: number
  error: string | null
  createdAt: string
  printedAt: string | null
  reprintOf: string | null
  canRetry: boolean
}
export interface OrderDetail {
  id: string
  orderNumber: string
  status: string
  lane: LaneId | null
  laneLabel: string | null
  paymentStatus: string | null
  area: string
  notes: string | null
  slot: string | null
  createdAt: string
  fulfillment: null | {
    stage: "PICKING" | "PACKING" | "DONE"
    picker: { id: string; name: string | null } | null
    packer: { id: string; name: string | null } | null
    pickStartedAt: string | null
    pickFinishedAt: string | null
    packStartedAt: string | null
    packFinishedAt: string | null
    packages: number
  }
  lines: PosLine[]
  blockers: { pick: Blocker[]; pack: Blocker[] }
  rider: null | { name: string; id: string; assignment: string; pickup: string | null; assignedAt: string | null; pickedUpAt: string | null }
  handover: null | { by: string | null; at: string; scan: string }
  printJobs: PrintJob[]
  bill: OrderBill | null
  can: {
    assignPeople: boolean
    startPick: boolean
    pick: boolean
    finishPick: boolean
    decideMissing: boolean
    startPack: boolean
    pack: boolean
    finishPack: boolean
    assignRider: boolean
    handover: boolean
    reprint: boolean
  }
}
export interface ScanResult {
  ok: true
  line: { id: string; name: string; required: number; picked: number; packed: number; status: LineStatus }
}
export interface TimelineItem {
  at: string
  source: "POS" | "ORDER" | "RIDER"
  kind: string
  actor: string | null
  text: string
}
export type RiderState = "OFFLINE" | "AVAILABLE" | "ASSIGNED" | "COMING_TO_STORE" | "AT_STORE" | "PICKED_UP" | "ON_DELIVERY"
export interface PosRider {
  id: string
  name: string
  vehicle: string | null
  state: RiderState
  online: boolean
  activeOrders: number
  maxActiveOrders: number | null
  forThisStore: number
  orders: Array<{ orderId: string; orderNumber: string; status: string; pickup: string | null; thisStore: boolean }>
}
export interface Printer {
  id: string
  name: string
  paperMm: 58 | 80 | 210
  isDefault: boolean
  lastSeenAt: string | null
  online: boolean
}
export interface PrintDocument {
  kind: "INVOICE" | "LABEL" | "TEST"
  paperMm: number
  html: string
}
export interface AttentionItem {
  kind: string
  label: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  orderId: string | null
  orderNumber: string | null
  ref: string
  since: string
  minutes: number | null
  text: string
  resolvable: boolean
  lineId?: string
  jobId?: string
}
export interface AttentionQueue {
  items: AttentionItem[]
  counts: { total: number; high: number }
}
export interface StaffMember {
  id: string
  name: string
  role: string
  pos_station: PosStation | null
}
export interface PosPerformance {
  range: { from: string; to: string; days: number }
  totals: {
    pickedOrders: number
    packedOrders: number
    avgPickMinutes: number | null
    avgPackMinutes: number | null
    scanMistakes: number
    manualConfirms: number
    missingReports: number
    handovers: number
    riderWaitMedianMinutes: number | null
    riderWaitSamples: number
    reassignments: number
  }
  people: Array<{
    userId: string | null
    name: string
    picked: null | { orders: number; avgMinutes: number | null; medianMinutes: number | null }
    packed: null | { orders: number; avgMinutes: number | null; medianMinutes: number | null }
    /** mistakeRate is already a percentage (20 = 20 %) */
    scans: { ok: number; manual: number; mistakes: number; mistakeRate: number | null }
    missingReports: number
    handovers: number
  }>
}
