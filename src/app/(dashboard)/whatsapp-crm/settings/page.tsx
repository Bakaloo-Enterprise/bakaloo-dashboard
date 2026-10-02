"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { ConnectionHero } from "@/components/whatsapp-crm/settings/ConnectionHero"
import { CredentialsForm } from "@/components/whatsapp-crm/settings/CredentialsForm"
import { SetupGuide } from "@/components/whatsapp-crm/settings/SetupGuide"
import { TestMessageCard } from "@/components/whatsapp-crm/settings/TestMessageCard"
import { TestResults } from "@/components/whatsapp-crm/settings/TestResults"
import { UsageCard } from "@/components/whatsapp-crm/settings/UsageCard"
import { WebhookCard } from "@/components/whatsapp-crm/settings/WebhookCard"
import { fieldErrors, settingsErrorMessage, useWaSettings, useWaSettingsMutations } from "@/hooks/useWhatsappSettings"
import type { WaSettingsInput, WaTestResult } from "@/types/whatsapp-settings.types"

export default function WhatsappSettingsPage() {
  // Everyone signed in may read the connection state; the server says whether THIS person may change it.
  const settings = useWaSettings(true)
  const m = useWaSettingsMutations()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<WaTestResult | null>(null)

  const view = settings.data
  const canManage = view?.canManage === true
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
      <PageHeader
        title="WhatsApp settings"
        subtitle={view && !canManage ? "See whether WhatsApp is connected." : "Connect your Meta WhatsApp Business API, test it, and keep an eye on usage and charges."}
      />

      {settings.isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}
      {settings.isError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Could not load the settings. {settingsErrorMessage(settings.error)}</p>}

      {view && !canManage && (
        <>
          <ConnectionHero view={view} readOnly testing={false} onTest={() => undefined} onToggle={() => undefined} toggling={false} />
          <div className="grid gap-6 lg:grid-cols-2">
            <WebhookCard view={view} readOnly />
            <section aria-label="Who can change this" className="space-y-2 rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
              <h2 className="text-base font-semibold text-foreground">Changing the connection</h2>
              <p>Only people who have been given the WhatsApp settings permission can change the connection details, test it or switch it on and off. Ask an administrator if something needs to change.</p>
            </section>
          </div>
        </>
      )}

      {view && canManage && (
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
