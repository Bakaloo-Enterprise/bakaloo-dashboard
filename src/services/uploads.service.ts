import api from "@/lib/api"
import type { ApiResponse } from "@/types"
import type { UploadedFile, UploadedImage } from "@/types/upload.types"

type UploadProgressHandler = (progress: number) => void

/** Upload a single image to Cloudinary via backend */
export async function uploadImage(
  file: File,
  onProgress?: UploadProgressHandler
): Promise<UploadedImage> {
  const formData = new FormData()
  formData.append("image", file)

  const { data } = await api.post<ApiResponse<UploadedImage>>(
    "/uploads/image",
    formData,
    {
      onUploadProgress: (event) => {
        if (!onProgress) return
        const total = event.total ?? file.size
        const progress = total
          ? Math.round((event.loaded / total) * 100)
          : 0
        onProgress(progress)
      },
    }
  )
  return data.data
}

export async function uploadFile(
  file: File,
  onProgress?: UploadProgressHandler
): Promise<UploadedFile> {
  const formData = new FormData()
  formData.append("file", file)

  const { data } = await api.post<ApiResponse<UploadedFile>>(
    "/uploads/file",
    formData,
    {
      onUploadProgress: (event) => {
        if (!onProgress) return
        const total = event.total ?? file.size
        const progress = total
          ? Math.round((event.loaded / total) * 100)
          : 0
        onProgress(progress)
      },
    }
  )
  return data.data
}

/** Upload multiple images */
export async function uploadMultipleImages(files: File[]): Promise<UploadedImage[]> {
  const formData = new FormData()
  files.forEach((f) => formData.append("images", f))

  const { data } = await api.post<ApiResponse<UploadedImage[]>>(
    "/uploads/images",
    formData
  )
  return data.data
}

/** Delete an uploaded image by publicId */
export async function deleteImage(publicId: string) {
  const { data } = await api.delete<ApiResponse<null>>("/uploads/image", {
    data: { publicId },
  })
  return data.data
}

/** Bulk import products from CSV */
export async function bulkImportProducts(file: File) {
  const formData = new FormData()
  formData.append("file", file)

  const { data } = await api.post<
    ApiResponse<{ imported: number; skipped: number; errors: string[] }>
  >("/products/bulk-import", formData)
  return data.data
}

/** Create manual order (admin places order for a customer) */
export async function createManualOrder(payload: {
  userId: string
  items: { productId: string; quantity: number; /** B2B: the price agreed for one unit */ unitPrice?: number }[]
  /** B2C (default) = home customer. B2B = a business buying on credit. */
  orderType?: "B2C" | "B2B"
  /** B2B: the date they promised to pay by (YYYY-MM-DD). */
  dueDate?: string
  /** B2B: money received while taking the order. */
  advance?: { amount: number; method: "CASH" | "UPI" }
  paymentMethod?: "COD" | "MANUAL"
  /** The store that delivers the order. Leave out only when one store is the obvious choice. */
  shopId?: string
  /** MANUAL only: the money is already in hand. Otherwise the order starts unpaid. */
  paymentReceived?: boolean
  deliveryAddress?: Record<string, unknown>
  couponCode?: string
}) {
  const { data } = await api.post<
    ApiResponse<{ id: string; order_number: string; total_amount: number }>
  >("/admin/orders/manual", payload)
  return data.data
}

/** A customer as the Create Order screen shows them: with the labels staff need. */
export interface StaffCustomer {
  id: string
  name: string | null
  phone: string
  orderCount: number
  kind: "BUSINESS" | "HOME"
  businessName: string | null
  gstin: string | null
  hasBusinessAccount: boolean
  addedByStaff: boolean
  /** Added by staff and has never opened the app. */
  notOnApp: boolean
  existing?: boolean
}

export async function lookupOrderCustomers(search: string) {
  const { data } = await api.get<ApiResponse<StaffCustomer[]>>("/admin/orders/customers/lookup", { params: { search } })
  return data.data
}

/** Add a customer who is not on the platform yet. A phone number that already has an account returns that account. */
export async function addOrderCustomer(input: { name: string; phone: string; kind: "HOME" | "BUSINESS"; businessName?: string; gstin?: string }) {
  const { data } = await api.post<ApiResponse<StaffCustomer>>("/admin/orders/customers", input)
  return data.data
}
