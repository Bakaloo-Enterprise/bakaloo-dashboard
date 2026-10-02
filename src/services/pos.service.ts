import api from "@/lib/api"
import type { ApiResponse } from "@/types/api.types"
import type {
  AttentionQueue, Board, OrderDetail, PosMe, PosPerformance, PosRider, PosStation, PrintDocument, PrintJob, Printer, ScanResult, Stage, StaffMember, TimelineItem,
} from "@/types/pos.types"

const BASE = "/pos"
const get = async <T>(url: string, params?: object) => (await api.get<ApiResponse<T>>(`${BASE}${url}`, { params })).data.data
const post = async <T>(url: string, body: object = {}) => (await api.post<ApiResponse<T>>(`${BASE}${url}`, body)).data.data

export const getPosMe = () => get<PosMe>("/me")
export const getBoard = () => get<Board>("/board")
export const getOrder = (id: string) => get<OrderDetail>(`/orders/${id}`)
export const getTimeline = (id: string) => get<TimelineItem[]>(`/orders/${id}/timeline`)
export const assignPerson = (id: string, role: "PICKER" | "PACKER", userId: string) => post<OrderDetail>(`/orders/${id}/assign`, { role, userId })
export const startPick = (id: string) => post<OrderDetail>(`/orders/${id}/start-pick`)
export const scan = (id: string, stage: Stage, code: string) => post<ScanResult>(`/orders/${id}/scan`, { stage, code })
export const confirmLine = (id: string, lineId: string, stage: Stage, qty?: number) => post<ScanResult>(`/orders/${id}/lines/${lineId}/confirm`, { stage, ...(qty ? { qty } : {}) })
export const reportMissing = (id: string, lineId: string, note: string) => post<OrderDetail>(`/orders/${id}/lines/${lineId}/missing`, { note })
export const decideMissing = (id: string, lineId: string, decision: "REPLACE" | "REMOVE" | "REFUND", note: string) => post<OrderDetail>(`/orders/${id}/lines/${lineId}/decision`, { decision, note })
export const finishPick = (id: string) => post<OrderDetail>(`/orders/${id}/finish-pick`)
export const startPack = (id: string) => post<OrderDetail>(`/orders/${id}/start-pack`)
export const finishPack = (id: string, packageCount: number) => post<OrderDetail>(`/orders/${id}/finish-pack`, { packageCount })
export const assignRiderToOrder = (id: string, riderId: string) => post<OrderDetail>(`/orders/${id}/rider`, { riderId })
export const handover = (id: string) => post<OrderDetail>(`/orders/${id}/handover`)

export const getRiders = () => get<PosRider[]>("/riders")
export const getStaff = () => get<StaffMember[]>("/staff")
export const setStation = async (userId: string, station: PosStation | null) => (await api.patch<ApiResponse<StaffMember[]>>(`${BASE}/staff/${userId}`, { station })).data.data

export const getPrinters = () => get<Printer[]>("/printers")
export const addPrinter = (input: { name: string; paperMm: number; isDefault: boolean }) => post<Printer[]>("/printers", input)
export const updatePrinter = async (id: string, input: { name?: string; paperMm?: number; isDefault?: boolean }) => (await api.patch<ApiResponse<Printer[]>>(`${BASE}/printers/${id}`, input)).data.data
export const removePrinter = async (id: string) => (await api.delete<ApiResponse<Printer[]>>(`${BASE}/printers/${id}`)).data.data
export const heartbeat = (id: string) => post<{ ok: boolean }>(`/printers/${id}/heartbeat`)
export const testPrint = (id: string) => post<{ ok: boolean }>(`/printers/${id}/test`)

export const getJobs = (params: { status?: string; printerId?: string; limit?: number } = {}) => get<PrintJob[]>("/print/jobs", params)
export const claimJob = (id: string) => post<PrintJob>(`/print/jobs/${id}/claim`)
export const getDocument = (id: string) => get<PrintDocument>(`/print/jobs/${id}/document`)
export const reportJob = (id: string, ok: boolean, error?: string) => post<PrintJob>(`/print/jobs/${id}/result`, { ok, ...(error ? { error } : {}) })
export const retryJob = (id: string) => post<PrintJob>(`/print/jobs/${id}/retry`)
export const reprintJob = (id: string) => post<PrintJob>(`/print/jobs/${id}/reprint`)

export const getAttention = () => get<AttentionQueue>("/attention")
export const resolveAttention = (input: { orderId: string; kind: string; ref?: string; note?: string }) => post<AttentionQueue>("/attention/resolve", input)
export const getPerformance = (params: { from?: string; to?: string }) => get<PosPerformance>("/performance", params)
