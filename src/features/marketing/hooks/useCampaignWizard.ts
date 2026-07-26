/** useCampaignWizard — multi-step form state with sessionStorage draft */

import { useState, useCallback } from 'react'
import { createSessionDraft } from '@/lib/session-draft'
import { generateIdempotencyKey } from '../marketing.utils'
import type { CampaignWizardState, WizardStep, MarketingChannel, SegmentFilter } from '../marketing.types'

const draft = createSessionDraft<CampaignWizardState>('hp_campaign_wizard_draft')
const loadDraft = () => draft.load()
const saveDraft = (state: CampaignWizardState) => draft.save(state)
const clearDraft = () => draft.clear()

const DEFAULT_FILTER: SegmentFilter = { partyType: 'CUSTOMER' }

function buildInitial(): CampaignWizardState {
  const draft = loadDraft()
  return {
    step: 1,
    name: draft.name ?? '',
    channel: draft.channel ?? 'WHATSAPP',
    templateId: draft.templateId ?? '',
    segmentFilter: draft.segmentFilter ?? DEFAULT_FILTER,
    scheduledAt: draft.scheduledAt ?? null,
    sendNow: draft.sendNow ?? true,
    idempotencyKey: draft.idempotencyKey ?? generateIdempotencyKey(),
  }
}

export function useCampaignWizard() {
  const [state, setState] = useState<CampaignWizardState>(buildInitial)

  const update = useCallback(<K extends keyof CampaignWizardState>(
    key: K,
    value: CampaignWizardState[K],
  ) => {
    setState((prev) => {
      const next = { ...prev, [key]: value }
      saveDraft(next)
      return next
    })
  }, [])

  const setStep = useCallback((step: WizardStep) => {
    setState((prev) => {
      const next = { ...prev, step }
      saveDraft(next)
      return next
    })
  }, [])

  const setChannel = useCallback((channel: MarketingChannel) => {
    setState((prev) => {
      // Reset template when channel changes
      const next = { ...prev, channel, templateId: '' }
      saveDraft(next)
      return next
    })
  }, [])

  const setSegmentFilter = useCallback((filter: SegmentFilter) => {
    setState((prev) => {
      const next = { ...prev, segmentFilter: filter }
      saveDraft(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    clearDraft()
    setState({ ...buildInitial(), idempotencyKey: generateIdempotencyKey(), step: 1, name: '', templateId: '', segmentFilter: DEFAULT_FILTER, scheduledAt: null, sendNow: true })
  }, [])

  const canAdvance = useCallback((fromStep: WizardStep): boolean => {
    switch (fromStep) {
      case 1: return state.name.trim().length > 0
      case 2: return state.templateId.length > 0
      case 3: return true // segment preview validates async
      case 4: return true
      case 5: return false
      default: return false
    }
  }, [state.name, state.templateId])

  return { state, update, setStep, setChannel, setSegmentFilter, reset, canAdvance }
}
