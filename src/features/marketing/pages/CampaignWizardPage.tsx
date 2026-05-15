/** CampaignWizardPage — /marketing/campaigns/new — 5-step wizard */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
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

function StepIndicator({ current, total, ariaLabel }: { current: WizardStep; total: number; ariaLabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', marginBottom: '20px' }} role="group" aria-label={ariaLabel}>
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as WizardStep
        const done = step < current
        const active = step === current
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: active ? 28 : 22,
                height: 22,
                borderRadius: '999px',
                background: done ? 'var(--color-success-500)' : active ? 'var(--color-primary-600)' : 'var(--color-gray-200)',
                color: done || active ? 'white' : 'var(--color-gray-400)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                transition: 'all 0.15s ease',
              }}
              aria-current={active ? 'step' : undefined}
            >
              {step}
            </div>
            {i < total - 1 && (
              <div style={{ width: 16, height: 2, background: done ? 'var(--color-success-400)' : 'var(--color-gray-200)' }} />
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
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={handleBack} aria-label={t.marketingBackAria}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>{t.marketingNewCampaignTitle}</h1>
          <div style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>{stepLabel}</div>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={state.step} total={5} ariaLabel={stepAria} />

      {/* Step content */}
      <div style={{ minHeight: 300 }}>
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
        <button
          type="button"
          onClick={handleNext}
          disabled={!canAdvance(state.step)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            marginTop: '24px',
            padding: '14px',
            minHeight: '44px',
            borderRadius: '12px',
            border: 'none',
            background: canAdvance(state.step) ? 'var(--color-primary-600)' : 'var(--color-gray-200)',
            color: canAdvance(state.step) ? 'white' : 'var(--color-gray-400)',
            fontWeight: 700,
            fontSize: '15px',
            cursor: canAdvance(state.step) ? 'pointer' : 'not-allowed',
          }}
          aria-disabled={!canAdvance(state.step)}
        >
          {t.marketingNext} <ChevronRight size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
