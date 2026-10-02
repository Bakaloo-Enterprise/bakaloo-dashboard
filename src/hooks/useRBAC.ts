import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getTeamMembers,
  inviteMember,
  updateMember,
  removeMember,
  resetMemberPassword,
} from "@/services/rbac.service"
import type {
  CreateRolePayload,
  UpdateRolePayload,
  InviteMemberPayload,
  UpdateMemberPayload,
} from "@/types/rbac.types"
import { useAuthStore } from "@/store/auth.store"
import { useShopContext } from "@/hooks/useShopContext"
import {
  findRouteGuard,
  isMenuItemAllowed,
  primaryEntityFor,
  satisfies,
  type PermissionSubject,
  type Role,
  type RouteGuard,
} from "@/lib/permissions"

/** The server's own reason (e.g. "A user with this email already exists") beats a generic failure line. */
function reason(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return typeof message === "string" && message.trim() && message.trim().length < 200 ? message.trim() : fallback
}


/* ── Roles ── */

/** A permission refusal will not fix itself — fail at once instead of retrying (and flashing an empty list). */
const noRetryOnForbidden = (count: number, err: unknown) =>
  (err as { response?: { status?: number } })?.response?.status !== 403 && count < 2

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnForbidden,
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRolePayload) => createRole(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      toast.success("Role created")
    },
    onError: (err) => toast.error(reason(err, "Failed to create role")),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: string; payload: UpdateRolePayload }) =>
      updateRole(roleId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      toast.success("Role updated")
    },
    onError: (err) => toast.error(reason(err, "Failed to update role")),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      toast.success("Role deleted")
    },
    onError: (err) => toast.error(reason(err, "Failed to delete role")),
  })
}

/* ── Team Members ── */

/**
 * Sentinel `shopId` slot used in the team-members query key while the
 * Shop_Context_Store hydrates. Mirrors the convention from `useOrders`.
 */
const NONE_SHOP_KEY = "NONE"

export function useTeamMembers() {
  // Read shop scope here (rather than at the top of the file) so the rest
  // of useRBAC's hooks remain pure of shop-context dependencies.
  const { mode, activeShopId } = useShopContext()
  const shopKey =
    mode === "HQ_MODE" ? "ALL" : activeShopId ?? NONE_SHOP_KEY

  return useQuery({
    retry: noRetryOnForbidden,
    // Keyed under the central `team` tag so the Shop_Switcher predicate
    // invalidation reaches every cache entry on a shop pivot (Req 3.4,
    // 10.3). The `members` discriminator lets us add adjacent
    // sub-resources (invitations, audit log) under the same tag without
    // collisions.
    queryKey: ["team", shopKey, "members"] as const,
    queryFn: getTeamMembers,
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useInviteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) => inviteMember(payload),
    onSuccess: () => {
      // Prefix-based invalidate covers every shop-keyed `team` entry
      // (members, invites, etc.) in one pass.
      qc.invalidateQueries({ queryKey: ["team"] })
      toast.success("Team member invited")
    },
    onError: (err) => toast.error(reason(err, "Failed to invite member")),
  })
}

export function useUpdateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, payload }: { memberId: string; payload: UpdateMemberPayload }) =>
      updateMember(memberId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] })
      toast.success("Member updated")
    },
    onError: (err) => toast.error(reason(err, "Failed to update member")),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] })
      toast.success("Member removed")
    },
    onError: (err) => toast.error(reason(err, "Failed to remove member")),
  })
}

/**
 * Reset a team member's password. No cache invalidation on success — this
 * mutation doesn't change anything the list displays (role/status/last
 * login are untouched). The caller reads `data.temp_password` from the
 * mutation result to show the one-time reveal dialog; we don't toast a
 * generic success here since that dialog IS the success state.
 */
export function useResetMemberPassword() {
  return useMutation({
    mutationFn: (memberId: string) => resetMemberPassword(memberId),
    onError: (err) => toast.error(reason(err, "Failed to reset password")),
  })
}


/* ── Route & Menu RBAC ── */

/**
 * Map an `AdminUser.role` string (which may be the legacy `"ADMIN"` carried
 * by the existing auth profile) onto the canonical `Role` union used by the
 * permission map. The backend issues `role: "ADMIN"` for platform Super
 * Admins until the shop-aware auth profile lands in task 2.x; we treat both
 * `"SUPER_ADMIN"` and `"ADMIN"` as Super Admin so menu and route gating
 * behave correctly during the transition.
 */
function normalizeRole(raw: string | null | undefined): Role {
  if (!raw) return "SHOP_VIEWER"
  if (raw === "SUPER_ADMIN" || raw === "ADMIN") return "SUPER_ADMIN"
  if (raw === "SHOP_ADMIN") return "SHOP_ADMIN"
  if (raw === "SHOP_MANAGER") return "SHOP_MANAGER"
  if (raw === "SHOP_STAFF") return "SHOP_STAFF"
  if (raw === "SHOP_VIEWER") return "SHOP_VIEWER"
  // Unknown / customer / delivery → fall back to the most restrictive role
  // that still has a permission entry; the actual gating still relies on the
  // `permissions[]` array, which is empty for these users.
  return "SHOP_VIEWER"
}

/**
 * The minimal subject the permission map needs. Built lazily so any change
 * to the auth or shop-context stores triggers a re-evaluation.
 */
function useRBACSubject(): PermissionSubject {
  const role = useAuthStore((s) => s.user?.role)
  const userPerms = useAuthStore((s) => s.user?.permissions)
  const shopPerms = useShopContext().permissions

  return useMemo(() => {
    // Merge the user's top-level permissions with the shop-scoped tokens
    // returned by `/auth/select-shop`. Both are sourced from the JWT and
    // represent what the operator can do in the current scope.
    const merged = new Set<string>([...(userPerms ?? []), ...(shopPerms ?? [])])
    return {
      role: normalizeRole(role),
      permissions: Array.from(merged),
    }
  }, [role, userPerms, shopPerms])
}

/**
 * Result of `useRouteRBAC()` — a structural answer to "may the user enter
 * this route, and what mutation surface should it expose?"
 *
 * - `isAuthorized` — does the user satisfy the route's guard?
 *                    True for unguarded routes (no entry in `ROUTE_GUARDS`).
 * - `canRead`      — has any read permission for the route's primary entity.
 *                    Used by pages to decide whether the list query should
 *                    be issued at all.
 * - `canWrite`     — has any write/delete permission for the same entity.
 *                    Used by pages to hide create/edit/delete affordances.
 * - `requiresActiveShop` / `superAdminOnly` — surfaced for callers that want
 *                    to render bespoke empty states (e.g. `<EmptyShopState />`).
 */
export interface RouteRBAC {
  isAuthorized: boolean
  canRead: boolean
  canWrite: boolean
  requiresActiveShop: boolean
  superAdminOnly: boolean
  guard: RouteGuard | null
}

/**
 * Resolve a route guard for `pattern` and evaluate it against the current
 * user. Re-evaluates whenever the auth or shop-context store changes, so the
 * UI updates without a full page reload (Req 4.6).
 *
 * `pattern` may be:
 *   - a literal pathname — matched against the registered `ROUTE_GUARDS`
 *   - a custom `RouteGuard` object — evaluated directly
 *
 * For literal pathnames the first registered guard whose `pattern` matches
 * is used (matching the App Router's natural first-match resolution).
 */
export function useRouteRBAC(pattern: string | RouteGuard): RouteRBAC {
  const subject = useRBACSubject()
  const { mode } = useShopContext()
  const hasActiveShop = mode === "STORE_MODE"

  return useMemo<RouteRBAC>(() => {
    // Resolve the guard from the input.
    const guard: RouteGuard | null =
      typeof pattern === "string" ? findRouteGuard(pattern) : pattern

    // Unguarded route: treat as fully authorized; entity-derived flags
    // default to `false` because we have no entity to derive them from.
    if (!guard) {
      return {
        isAuthorized: true,
        canRead: false,
        canWrite: false,
        requiresActiveShop: false,
        superAdminOnly: false,
        guard: null,
      }
    }

    // Guard satisfied by the user?
    let isAuthorized = satisfies(subject, guard)

    // The Active_Shop_Id requirement (Req 4.5): pages that need a single
    // shop are not authorized in ALL_SHOPS / UNSELECTED mode even if the
    // user holds the read permission.
    if (guard.requiresActiveShop && !hasActiveShop) {
      isAuthorized = false
    }

    // SUPER_ADMIN has all permissions — skip permission-string checks.
    const isSuperAdmin = subject.role === "SUPER_ADMIN"

    // canRead / canWrite from the primary entity prefix.
    const entity = primaryEntityFor(guard)
    const canRead = isSuperAdmin
      ? true
      : entity
        ? subject.permissions.some(
            (p) => p === `${entity}.read` || p.startsWith(`${entity}.read.`),
          )
        : false
    const canWrite = isSuperAdmin
      ? true
      : entity
        ? subject.permissions.some(
            (p) => p === `${entity}.write` || p === `${entity}.delete`,
          )
        : false

    return {
      isAuthorized,
      canRead,
      canWrite,
      requiresActiveShop: Boolean(guard.requiresActiveShop),
      superAdminOnly: Boolean(guard.superAdminOnly),
      guard,
    }
  }, [pattern, subject, hasActiveShop])
}

/**
 * Decide whether a sidebar menu item is currently visible. Items not listed
 * in `MENU_PERMISSIONS` are always visible (legacy items predating the
 * permission map). Re-evaluates on auth or shop-context change.
 *
 * Validates Requirements 4.2, 4.5, 4.6, 4.7.
 */
export function useMenuRBAC(itemId: string): boolean {
  const subject = useRBACSubject()
  const { mode } = useShopContext()
  const hasActiveShop = mode === "STORE_MODE"

  return useMemo(
    () => isMenuItemAllowed(itemId, subject, { hasActiveShop }),
    [itemId, subject, hasActiveShop],
  )
}


/**
 * Batched menu-visibility lookup. Returns a `Record<itemId, boolean>` for the
 * supplied ids. Ids absent from `MENU_PERMISSIONS` are treated as legacy and
 * always allowed (mirroring `useMenuRBAC`).
 *
 * Used by the sidebar to (1) decide which items render and (2) decide whether
 * a section header should appear when every item in the section is hidden.
 *
 * Validates Requirements 4.2, 4.5, 4.6, 4.7.
 */
export function useMenuVisibility(
  ids: readonly string[],
): Record<string, boolean> {
  const subject = useRBACSubject()
  const { mode } = useShopContext()
  const hasActiveShop = mode === "STORE_MODE"

  return useMemo(() => {
    const out: Record<string, boolean> = {}
    for (const id of ids) {
      out[id] = isMenuItemAllowed(id, subject, { hasActiveShop })
    }
    return out
    // `ids` is the static nav config — its identity is stable across renders.
    // We still depend on it explicitly so a future dynamic config triggers a
    // recompute; subject + hasActiveShop drive the live re-evaluation.
  }, [ids, subject, hasActiveShop])
}
