"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Skeleton } from "@/components/ui/skeleton"
import { ConnectionHero } from "@/components/whatsapp-crm/settings/ConnectionHero"
import { CredentialsForm } from "@/components/whatsapp-crm/settings/CredentialsForm"
import { SetupGuide } from "@/components/whatsapp-crm/settings/SetupGuide"
import { TestMessageCard } from "@/components/whatsapp-crm/settings/TestMessageCard"
import { TestResults } from "@/components/whatsapp-crm/settings/TestResults"
import { UsageCard } from "@/components/whatsapp-crm/settings/UsageCard"
import { WebhookCard } from "@/components/whatsapp-crm/settings/WebhookCard"
import { useCrmMe } from "@/hooks/useWhatsappCrm"
import { fieldErrors, settingsErrorMessage, useWaSettings, useWaSettingsMutations } from "@/hooks/useWhatsappSettings"
import type { WaSettingsInput, WaTestResult } from "@/types/whatsapp-settings.types"

export default function WhatsappSettingsPage() {
  const me = useCrmMe()
  const allowed = me.can("crm.settings.manage")
  const settings = useWaSettings(allowed)
  const m = useWaSettingsMutations()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<WaTestResult | null>(null)

  if (me.isLoading) return <Skeleton className="h-48 w-full" />
  if (!allowed) return <Forbidden />

  const view = settings.data
  const shown = result ?? view?.lastTest ?? null
  const working = m.save.isPending || m.test.isPending

  const runTest = (sendTo?: string) => m.test.mutate(sendTo, { onSuccess: (r) => { setResult(r); toast[r.ok ? "success" : "error"](r.headline) } })

  const submit = async (input: WaSettingsInput, thenTest: boolean) => {
    setErrors({})
    if (Object.keys(input).length > 0) {
      try {
        await m.save.mutateAsync(input)
      } catch (err) {
        const fe = fieldErrors(err)
        setErrors(fe)
        toast.error(Object.keys(fe).length ? "Please check the highlighted fields." : settingsErrorMessage(err))
        return
      }
    }
    if (thenTest) runTest()
    else toast.success("Saved")
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="WhatsApp settings" subtitle="Connect your Meta WhatsApp Business API, test it, and keep an eye on usage and charges." />

      {settings.isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}
      {settings.isError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Could not load the settings. {settingsErrorMessage(settings.error)}</p>}

      {view && (
        <>
          <ConnectionHero view={view} testing={m.test.isPending} onTest={() => runTest()} onToggle={(on) => m.enable.mutate(on)} toggling={m.enable.isPending} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <CredentialsForm view={view} busy={working} errors={errors} onSubmit={submit} onRemove={() => { setResult(null); m.clear.mutate() }} />
              {shown && <TestResults result={shown} />}
            </div>
            <div className="space-y-6">
              <WebhookCard view={view} />
              <TestMessageCard disabled={view.state === "NOT_CONFIGURED"} busy={m.test.isPending} onSend={(phone) => runTest(phone)} />
            </div>
          </div>

          <UsageCard />
          <SetupGuide />
        </>
      )}
    </div>
  )
}
