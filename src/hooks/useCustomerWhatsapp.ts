"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getCustomerThread, openCustomerConversation } from "@/services/whatsapp-crm.service"
import { errorMessage } from "@/hooks/useWhatsappCrm"

/** WhatsApp history with one customer. Quietly empty (not an error) for people without CRM access. */
export function useCustomerThread(customerId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["customers", "whatsapp-thread", customerId],
    queryFn: () => getCustomerThread(customerId as string),
    enabled: Boolean(customerId) && enabled,
    staleTime: 15_000,
    retry: false,
  })
}

/** Find or create the customer's conversation (the 24-hour window is NOT opened by this). */
export function useOpenCustomerConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (customerId: string) => openCustomerConversation(customerId),
    onSuccess: (_c, customerId) => qc.invalidateQueries({ queryKey: ["customers", "whatsapp-thread", customerId] }),
    // The dialog shows the reason in place (e.g. no valid mobile number), so no extra toast here.
    onError: () => undefined,
  })
}

export { errorMessage as whatsappErrorMessage }
