import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  bulkImportProducts,
  createManualOrder,
} from "@/services/uploads.service"
import { toast } from "sonner"

export function useUploadImage(kind?: string) {
  return useMutation({
    mutationFn: (file: File) => uploadImage(file, undefined, kind),
    onError: (e: Error) => toast.error(e.message || "Image upload failed"),
  })
}

export function useUploadMultipleImages(kind?: string) {
  return useMutation({
    mutationFn: (files: File[]) => uploadMultipleImages(files, kind),
    onError: (e: Error) => toast.error(e.message || "Image upload failed"),
  })
}

export function useDeleteImage() {
  return useMutation({
    mutationFn: (publicId: string) => deleteImage(publicId),
    onError: (e: Error) => toast.error(e.message || "Delete failed"),
  })
}

export function useBulkImportProducts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => bulkImportProducts(file),
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.imported} products${result.skipped ? `, ${result.skipped} skipped` : ""}${result.errors?.length ? `, ${result.errors.length} errors` : ""}`
      )
      qc.invalidateQueries({ queryKey: ["products"] })
    },
    onError: (e: Error) => toast.error(e.message || "Import failed"),
  })
}

export function useCreateManualOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createManualOrder,
    onSuccess: (result) => {
      toast.success(`Order ${result.order_number} created — ₹${result.total_amount}`)
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create order"),
  })
}
