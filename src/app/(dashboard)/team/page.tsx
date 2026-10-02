"use client"

import { Suspense, useState } from "react"
import {
  Users,
  Shield,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  UserCheck,
  UserX,
  Check,
  KeyRound,
  AlertTriangle,
  Copy,
} from "lucide-react"
import { toast } from "sonner"
import { Forbidden } from "@/components/shared/forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useTeamMembers,
  useInviteMember,
  useUpdateMember,
  useRemoveMember,
  useResetMemberPassword,
} from "@/hooks/useRBAC"
import type {
  Role,
  PermissionKey,
  CreateRolePayload,
  InviteMemberPayload,
} from "@/types/rbac.types"
import { PERMISSION_GROUPS } from "@/types/rbac.types"
import { formatRelativeTime } from "@/lib/utils"
import { usePermissions } from "@/hooks/usePermissions"

export default function TeamPage() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="table" />}>
      <TeamContent />
    </Suspense>
  )
}

function TeamContent() {
  const [activeTab, setActiveTab] = useState("members")
  const { can } = usePermissions()
  const canManageTeam = can("team.manage")
  // The server decides who may see the team (role permission team.view). Same query the Roles tab uses, so no extra request.
  const rolesProbe = useRoles()
  if ((rolesProbe.error as { response?: { status?: number } } | null)?.response?.status === 403) return <Forbidden />

  return (
    <div className="space-y-6">
      <PageHeader title="Team & Roles" subtitle="Manage team members and role-based permissions">
        <div className="flex items-center gap-2">
          {activeTab === "members" && canManageTeam && <InviteMemberButton />}
          {activeTab === "roles" && canManageTeam && <CreateRoleButton />}
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9">
          <TabsTrigger value="members" className="text-xs px-4">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Team Members
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-xs px-4">
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            Roles & Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <MembersTab />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ─────────────────────── Members Tab ─────────────────────── */

function MembersTab() {
  const { data: members, isLoading } = useTeamMembers()
  const updateMember = useUpdateMember()
  const removeMember = useRemoveMember()
  const resetPassword = useResetMemberPassword()
  const { data: roles } = useRoles()
  const [changingRole, setChangingRole] = useState<{ id: string; roleId: string } | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [tempPasswordMemberName, setTempPasswordMemberName] = useState("")
  const { can } = usePermissions()
  const canManageTeam = can("team.manage")

  const handleResetPassword = (memberId: string, memberName: string) => {
    resetPassword.mutate(memberId, {
      onSuccess: (result) => {
        setTempPasswordMemberName(memberName)
        setTempPassword(result.temp_password)
      },
    })
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (!members || members.length === 0) {
    return (
      <EmptyState
        title="No team members"
        description="Invite your first team member to get started"
      />
    )
  }

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium text-sm">{m.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    {m.role_name}
                  </Badge>
                </TableCell>
                <TableCell>
                  {m.is_active ? (
                    <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                      <UserCheck className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <UserX className="h-3 w-3 mr-1" />
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {m.last_login_at ? formatRelativeTime(m.last_login_at) : "Never"}
                </TableCell>
                <TableCell>
                  {canManageTeam && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setChangingRole({ id: m.id, roleId: m.role_id })
                        }
                      >
                        <Shield className="h-3.5 w-3.5 mr-2" />
                        Change Role
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          updateMember.mutate({
                            memberId: m.id,
                            payload: { is_active: !m.is_active },
                          })
                        }
                      >
                        {m.is_active ? (
                          <>
                            <UserX className="h-3.5 w-3.5 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleResetPassword(m.id, m.name)}
                        disabled={resetPassword.isPending}
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-2" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => removeMember.mutate(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={!!changingRole} onOpenChange={(open) => !open && setChangingRole(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Role</Label>
            <Select
              value={changingRole?.roleId ?? ""}
              onValueChange={(v) =>
                setChangingRole((prev) => (prev ? { ...prev, roleId: v } : null))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose role..." />
              </SelectTrigger>
              <SelectContent>
                {assignable(roles).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangingRole(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (changingRole) {
                  updateMember.mutate({
                    memberId: changingRole.id,
                    payload: { role_id: changingRole.roleId },
                  })
                  setChangingRole(null)
                }
              }}
              disabled={updateMember.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Modal — shown once, never persisted client-side */}
      <Dialog open={!!tempPassword} onOpenChange={() => setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This password will only be shown <strong>once</strong>. Copy it
                now and share it securely with {tempPasswordMemberName}. It
                cannot be retrieved later.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-muted px-4 py-3 font-mono text-lg tracking-wider select-all">
                {tempPassword}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword ?? "")
                  toast.success("Copied to clipboard")
                }}
                className="gap-1"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ─────────────────────── Roles Tab ─────────────────────── */

function RolesTab() {
  const { data: roles, isLoading } = useRoles()
  const deleteRole = useDeleteRole()
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const { can } = usePermissions()
  const canManageTeam = can("team.manage")

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!roles || roles.length === 0) {
    return (
      <EmptyState
        title="No roles defined"
        description="Create your first role to set up permissions"
      />
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <Card key={role.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  {role.name}
                </CardTitle>
                {!role.is_system && canManageTeam && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingRole(role)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Edit Permissions
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteRole.mutate(role.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-3 space-y-2">
              <p className="text-sm text-muted-foreground">{role.description}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  <Users className="h-3 w-3 inline mr-1" />
                  {role.admin_count ?? 0} members
                </span>
                <span>
                  <Check className="h-3 w-3 inline mr-1" />
                  {role.permissions.length} permissions
                </span>
              </div>
              {role.is_system && (
                <Badge variant="secondary" className="text-[10px]">
                  System Role
                </Badge>
              )}
              <div className="flex flex-wrap gap-1 pt-1">
                {role.permissions.slice(0, 6).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px] font-normal">
                    {p}
                  </Badge>
                ))}
                {role.permissions.length > 6 && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    +{role.permissions.length - 6} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Role Dialog */}
      {editingRole && (
        <RoleEditorDialog
          role={editingRole}
          open={!!editingRole}
          onClose={() => setEditingRole(null)}
        />
      )}
    </>
  )
}

/* ─────────────────── Permission Matrix Dialog ────────────── */

function RoleEditorDialog({
  role,
  open,
  onClose,
}: {
  role?: Role | null
  open: boolean
  onClose: () => void
}) {
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()

  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(
    new Set(role?.permissions ?? [])
  )

  const isEditing = !!role?.id

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleModule = (modulePerms: PermissionKey[]) => {
    setPermissions((prev) => {
      const next = new Set(prev)
      const allEnabled = modulePerms.every((p) => next.has(p))
      if (allEnabled) {
        modulePerms.forEach((p) => next.delete(p))
      } else {
        modulePerms.forEach((p) => next.add(p))
      }
      return next
    })
  }

  const handleSave = () => {
    const payload: CreateRolePayload = {
      name,
      description,
      permissions: Array.from(permissions),
    }
    if (isEditing) {
      updateRole.mutate(
        { roleId: role!.id, payload },
        { onSuccess: onClose }
      )
    } else {
      createRole.mutate(payload, { onSuccess: onClose })
    }
  }

  const isPending = createRole.isPending || updateRole.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Role" : "Create Role"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Manager"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                className="mt-1"
              />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-3">
              Permissions ({permissions.size} selected)
            </h4>
            <div className="space-y-4">
              {PERMISSION_GROUPS.map((group) => {
                const moduleKeys = group.permissions.map((p) => p.key)
                const allEnabled = moduleKeys.every((k) => permissions.has(k))
                const someEnabled = moduleKeys.some((k) => permissions.has(k))

                return (
                  <div key={group.module} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={allEnabled}
                        // @ts-expect-error indeterminate is valid
                        indeterminate={!allEnabled && someEnabled}
                        onCheckedChange={() => toggleModule(moduleKeys)}
                      />
                      <span className="text-sm font-medium">{group.module}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {moduleKeys.filter((k) => permissions.has(k)).length}/{moduleKeys.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-6">
                      {group.permissions.map((p) => (
                        <label
                          key={p.key}
                          className="flex items-center gap-2 py-1 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Checkbox
                            checked={permissions.has(p.key)}
                            onCheckedChange={() => togglePermission(p.key)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || isPending}>
            {isPending ? "Saving..." : isEditing ? "Update Role" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────────────── Invite Member Button/Dialog ─────────── */

/** Built-in HQ levels the dashboard cannot sign in yet — the server refuses them, so do not offer them. */
const CANNOT_SIGN_IN_ROLES = new Set(["HQ_FINANCE", "HQ_MANAGER", "HQ_SUPPORT"])
const assignable = <T extends { name: string }>(roles: T[] | undefined): T[] => (roles ?? []).filter((r) => !CANNOT_SIGN_IN_ROLES.has(r.name))

function InviteMemberButton() {
  const [open, setOpen] = useState(false)
  const { data: roles } = useRoles()
  const invite = useInviteMember()

  const [form, setForm] = useState<InviteMemberPayload>({
    name: "",
    email: "",
    phone: "",
    role_id: "",
    password: "",
  })

  const handleInvite = () => {
    invite.mutate(form, {
      onSuccess: () => {
        setOpen(false)
        setForm({ name: "", email: "", phone: "", role_id: "", password: "" })
      },
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Invite Member
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Full Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="John Doe"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="john@company.com"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone (optional)</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Initial Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 chars"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={form.role_id}
                onValueChange={(v) => setForm((f) => ({ ...f, role_id: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {assignable(roles).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} — {r.permissions.length} permissions
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!form.name || !form.email || !form.role_id || !form.password || invite.isPending}
            >
              {invite.isPending ? "Inviting..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ─────────────────── Create Role Button ─────────────────── */

function CreateRoleButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Create Role
      </Button>

      <RoleEditorDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
