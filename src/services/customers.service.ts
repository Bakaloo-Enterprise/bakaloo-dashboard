import api from "@/lib/api"
import type { CustomerNotification } from "@/types/customer.types"
import type { ApiResponse, Customer, CustomerAddress, CustomerDetail, CustomerFilters } from "@/types"

/** List customers with filters + pagination */
export async function getCustomers(filters: CustomerFilters = {}) {
  const params: Record<string, string | number> = {}
  if (filters.page) params.page = filters.page
  if (filters.limit) params.limit = filters.limit
  if (filters.search) params.search = filters.search
  if (filters.status) params.status = filters.status
  if (filters.segment) params.segment = filters.segment
  if (filters.sort) params.sortBy = filters.sort
  if (filters.order) params.sortOrder = filters.order === "asc" ? "ASC" : "DESC"
  // When the dashboard is in SINGLE_SHOP mode, the hook layer forwards the
  // active shop id here so the backend can restrict the result set to
  // customers with at least one allocation to that shop (Req 10.8). In
  // ALL_SHOPS mode the hook omits the field so this branch is skipped and
  // the unscoped super-admin list is returned.
  if (filters.shop_id) params.shop_id = filters.shop_id

  const { data } = await api.get<
    ApiResponse<{
      customers?: Customer[]
      data?: Customer[]
      activeToday?: number
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>
  >("/admin/customers", { params })

  const result = data.data
  return {
    customers: result.customers ?? result.data ?? [],
    activeToday: result.activeToday ?? 0,
    pagination: result.pagination,
  }
}

/** Get customer detail */
export async function getCustomerDetail(id: string) {
  const { data } = await api.get<ApiResponse<CustomerDetail>>(`/admin/customers/${id}`)
  return data.data
}

/** Get customer orders */
export async function getCustomerOrders(id: string, page = 1, limit = 10) {
  const { data } = await api.get<
    ApiResponse<{
      orders: Array<{
        id: string
        order_number: string
        total_amount: number
        status: string
        created_at: string
      }>
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>
  >(`/admin/customers/${id}/orders`, { params: { page, limit } })
  return data.data
}

/** Get a customer's saved addresses — active ones plus any still inside
 * their post-removal retention window (see `CustomerAddress.deletedAt`). */
export async function getCustomerAddresses(id: string) {
  const { data } = await api.get<ApiResponse<CustomerAddress[]>>(
    `/admin/customers/${id}/addresses`
  )
  return data.data
}

/** Block / unblock a customer */
export async function toggleBlockCustomer(id: string, blocked: boolean) {
  const { data } = await api.put<ApiResponse<Customer>>(`/admin/customers/${id}/block`, {
    blocked,
  })
  return data.data
}

/** Credit customer wallet */
export async function creditCustomerWallet(
  id: string,
  payload: { amount: number; description?: string }
) {
  const { data } = await api.post<ApiResponse<{ wallet_balance: number }>>(
    `/admin/customers/${id}/credit-wallet`,
    payload
  )
  return data.data
}

/** Debit customer wallet */
export async function debitCustomerWallet(
  id: string,
  payload: { amount: number; description?: string }
) {
  const { data } = await api.post<ApiResponse<{ wallet_balance: number }>>(
    `/admin/customers/${id}/debit-wallet`,
    payload
  )
  return data.data
}

/** Send notification to customer */
export async function notifyCustomer(
  id: string,
  payload: { title: string; body: string }
) {
  const { data } = await api.post<ApiResponse<null>>(
    `/admin/customers/${id}/notify`,
    payload
  )
  return data.data
}

/** What this customer was sent: only the personal messages, or every notification. */
export async function getCustomerNotifications(id: string, personal: boolean) {
  const { data } = await api.get<ApiResponse<CustomerNotification[]>>(`/admin/customers/${id}/notifications`, { params: { personal, limit: 50 } })
  return data.data
}

/** Export customers CSV */
export async function exportCustomersCsv() {
  const { data } = await api.get("/admin/customers/export", {
    responseType: "blob",
  })
  return data as Blob
}
