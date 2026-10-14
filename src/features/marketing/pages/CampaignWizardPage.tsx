/** CampaignWizardPage — /marketing/campaigns/new — 5-step wizard */

import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useCampaignWizard } from '../hooks/useCampaignWizard'
import { useCreateCampaign } from '../hooks/useCampaigns'
import { useCampaignLaunch } from '../hooks/useCampaignLaunch'
import { CampaignWizardStep1Channel } from '../components/CampaignWizardStep1Channel'
import { CampaignWizardStep2Template } from '../components/CampaignWizardStep2Template'
import { CampaignWizardStep3Audience } from '../components/CampaignWizardStep3Audience'
import { CampaignWizardStep4Schedule } from '../components/CampaignWizardStep4Schedule'
import { CampaignWizardStep5Preview } from '../components/CampaignWizardStep5Preview'
import { MARKETING_ROUTES } from '../marketing.constants'
import type { WizardStep } from '../marketing.types'
import { Button } from '@/components/ui/Button'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { cn } from '@/lib/utils'

function StepIndicator({ current, total, ariaLabel }: { current: WizardStep; total: number; ariaLabel: string }) {
  return (
    <div className="flex items-center gap-1 justify-center mb-5" role="group" aria-label={ariaLabel}>
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as WizardStep
        const done = step < current
        const active = step === current
        return (
          <div key={i} className="flex items-center gap-1">
            <div
              className={cn(
                'h-5.5 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                active ? 'w-7 bg-primary text-primary-foreground' : 'w-5.5',
                done && 'bg-[var(--color-success-500)] text-white',
                !done && !active && 'bg-muted text-[var(--text-muted)]'
              )}
              aria-current={active ? 'step' : undefined}
            >
              {step}
            </div>
            {i < total - 1 && (
              <div className={cn('w-4 h-0.5', done ? 'bg-[var(--color-success-400)]' : 'bg-muted')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function CampaignWizardPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { state, update, setStep, setChannel, setSegmentFilter, reset, canAdvance } = useCampaignWizard()
  const createMutation = useCreateCampaign()
  const launchMutation = useCampaignLaunch()

  const stepLabels = [
    t.marketingWizardStep1Label,
    t.marketingWizardStep2Label,
    t.marketingWizardStep3Label,
    t.marketingWizardStep4Label,
    t.marketingWizardStep5Label,
  ]

  const handleNext = () => {
    if (state.step < 5) setStep((state.step + 1) as WizardStep)
  }

  const handleBack = () => {
    if (state.step > 1) setStep((state.step - 1) as WizardStep)
    else navigate(MARKETING_ROUTES.CAMPAIGNS)
  }

  const handleLaunch = async () => {
    const payload = {
      name: state.name,
      channel: state.channel,
      templateId: state.templateId,
      segmentFilter: state.segmentFilter,
      scheduledAt: state.sendNow ? undefined : (state.scheduledAt ?? undefined),
    }

    const created = await createMutation.mutateAsync({ payload, idempotencyKey: state.idempotencyKey }).catch(() => null)
    if (!created || !('id' in created) || !created.id) return

    const launched = await launchMutation.mutateAsync({ id: created.id, name: created.name }).catch(() => null)
    if (launched) {
      reset()
      navigate(MARKETING_ROUTES.CAMPAIGN_DETAIL.replace(':id', created.id))
    }
  }

  const stepLabel = stepLabels[state.step - 1]
  const stepAria = `${t.marketingStepAriaLabel} ${state.step}/5`

  return (
    <AppShell
      header={
        <Header
          title={t.marketingNewCampaignTitle}
          subtitle={stepLabel}
          onBack={handleBack}
        />
      }
    >
      <PageContainer className="py-4 pb-24 max-w-lg mx-auto">

      {/* Step indicator */}
      <StepIndicator current={state.step} total={5} ariaLabel={stepAria} />

      {/* Step content */}
      <div className="min-h-[300px]">
        {state.step === 1 && (
          <CampaignWizardStep1Channel
            name={state.name}
            channel={state.channel}
            onNameChange={(name) => update('name', name)}
            onChannelChange={setChannel}
          />
        )}
        {state.step === 2 && (
          <CampaignWizardStep2Template
            channel={state.channel}
            value={state.templateId}
            onChange={(id) => update('templateId', id)}
          />
        )}
        {state.step === 3 && (
          <CampaignWizardStep3Audience
            value={state.segmentFilter}
            onChange={setSegmentFilter}
          />
        )}
        {state.step === 4 && (
          <CampaignWizardStep4Schedule
            sendNow={state.sendNow}
            scheduledAt={state.scheduledAt}
            onSendNowChange={(v) => update('sendNow', v)}
            onScheduledAtChange={(v) => update('scheduledAt', v)}
          />
        )}
        {state.step === 5 && (
          <CampaignWizardStep5Preview
            state={state}
            onLaunch={() => { void handleLaunch() }}
            launching={createMutation.isPending || launchMutation.isPending}
          />
        )}
      </div>

      {/* Next button (steps 1-4) */}
      {state.step < 5 && (
        <Button
          variant="primary"
          size="lg"
          className="w-full mt-6 gap-2"
          onClick={handleNext}
          disabled={!canAdvance(state.step)}
          aria-disabled={!canAdvance(state.step)}
        >
          <span>{t.marketingNext}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </Button>
      )}
      </PageContainer>
    </AppShell>
  )
}
