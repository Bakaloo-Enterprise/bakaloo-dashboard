"use client"

import { useState } from "react"
import { Lock, ShieldCheck, Unlock, UserPlus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  useDeveloperOverview,
  useDeveloperUsers,
  useFeatures,
  useGrantFeature,
  useRevokeFeature,
  useSetDeveloper,
  useSetReleased,
} from "@/hooks/useFeatures"
import { useAuthStore } from "@/store/auth.store"
import type { DeveloperFeature } from "@/services/features.service"

/** Developer Super Admin only: release features to everyone, give one person early access, manage developers. */
export default function DeveloperPage() {
  const access = useFeatures()
  if (access.isLoading) return <Skeleton className="h-64 w-full" />
  if (!access.data?.isDeveloper) {
    return (
      <div role="status" className="mx-auto mt-16 max-w-md rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        <Lock className="mx-auto mb-3 h-5 w-5" />
        This page is only for Developer Super Admins.
      </div>
    )
  }
  return <DeveloperConsole />
}

function DeveloperConsole() {
  const overview = useDeveloperOverview()
  const me = useAuthStore((s) => s.user)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="h-6 w-6" /> Developer Access
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Features that are still in development are locked for everyone except Developer Super Admins. Release a feature to open it for
          everyone who already has permission for it, or give a single person early access.
        </p>
      </div>

      {overview.isLoading && <Skeleton className="h-64 w-full" />}
      {overview.isError && <p className="text-sm text-danger">Could not load developer data.</p>}

      {overview.data?.features.map((f) => <FeatureCard key={f.key} feature={f} />)}

      {overview.data && (
        <DevelopersCard developers={overview.data.developers} myId={me?.id} />
      )}
    </div>
  )
}

function FeatureCard({ feature }: { feature: DeveloperFeature }) {
  const setReleased = useSetReleased()
  const grant = useGrantFeature()
  const revoke = useRevokeFeature()
  const [search, setSearch] = useState("")
  const people = useDeveloperUsers(search, search.length >= 2)

  const toggle = (released: boolean) => {
    const msg = released
      ? `Release "${feature.label}" to everyone who has permission for it?`
      : `Lock "${feature.label}" again? Everyone except developers will lose access.`
    if (window.confirm(msg)) setReleased.mutate({ key: feature.key, released })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {feature.label}
              {feature.released ? (
                <Badge className="gap-1"><Unlock className="h-3 w-3" /> Released</Badge>
              ) : (
                <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Locked</Badge>
              )}
            </CardTitle>
            {feature.description && <CardDescription className="mt-1">{feature.description}</CardDescription>}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            Released to everyone
            <Switch
              checked={feature.released}
              disabled={setReleased.isPending}
              onCheckedChange={toggle}
              aria-label={`Release ${feature.label} to everyone`}
            />
          </label>
        </div>
      </CardHeader>
      {!feature.released && (
        <CardContent className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Early access (while locked)</p>
          <div className="flex flex-wrap gap-2">
            {feature.grants.length === 0 && <span className="text-sm text-muted-foreground">Nobody yet — developers only.</span>}
            {feature.grants.map((g) => (
              <Badge key={g.userId} variant="outline" className="gap-1">
                {g.fullName || g.email}
                <button
                  type="button"
                  aria-label={`Remove ${g.fullName || g.email}`}
                  onClick={() => revoke.mutate({ key: feature.key, userId: g.userId })}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input placeholder="Search a team member to give early access…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search.length >= 2 && (
            <ul className="divide-y rounded-md border text-sm">
              {(people.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between px-3 py-2">
                  <span>{p.full_name || p.email} <span className="text-muted-foreground">{p.platform_role}</span></span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => grant.mutate({ key: feature.key, userId: p.id }, { onSuccess: () => setSearch("") })}
                  >
                    Give access
                  </Button>
                </li>
              ))}
              {people.data?.length === 0 && <li className="px-3 py-2 text-muted-foreground">No matching team members.</li>}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function DevelopersCard({ developers, myId }: { developers: { id: string; full_name: string | null; email: string | null }[]; myId?: string }) {
  const setDev = useSetDeveloper()
  const [search, setSearch] = useState("")
  const people = useDeveloperUsers(search, search.length >= 2)
  const devIds = new Set(developers.map((d) => d.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Developer Super Admins</CardTitle>
        <CardDescription>
          Developers can use every feature, including locked ones, and manage this page. Only a Super Admin or Admin can be made a developer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-md border text-sm">
          {developers.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-3 py-2">
              <span>{d.full_name || d.email}{d.id === myId && <span className="ml-2 text-muted-foreground">(you)</span>}</span>
              {d.id !== myId && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setDev.isPending}
                  onClick={() => window.confirm(`Remove developer access from ${d.full_name || d.email}?`) && setDev.mutate({ userId: d.id, isDeveloper: false })}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Input placeholder="Search a Super Admin / Admin to make a developer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search.length >= 2 && (
          <ul className="divide-y rounded-md border text-sm">
            {(people.data ?? []).filter((p) => !devIds.has(p.id) && ["SUPER_ADMIN", "ADMIN"].includes(p.platform_role ?? "")).map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2">
                <span>{p.full_name || p.email} <span className="text-muted-foreground">{p.platform_role}</span></span>
                <Button size="sm" variant="outline" onClick={() => setDev.mutate({ userId: p.id, isDeveloper: true }, { onSuccess: () => setSearch("") })}>
                  <UserPlus className="mr-1 h-3.5 w-3.5" /> Make developer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
