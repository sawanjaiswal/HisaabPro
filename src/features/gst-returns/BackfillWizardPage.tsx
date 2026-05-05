/**
 * GST Backfill Wizard — 5-step state machine
 *
 * Step 1: Preview counts
 * Step 2: Options (tax category, date range, POS setting)
 * Step 3: Confirmation + warning
 * Step 4: Processing (non-cancellable, polling)
 * Step 5: Complete (summary + errors)
 *
 * Idempotency key generated on entry to step 4, stored in sessionStorage
 * so a page refresh resumes the same job (if jobId is also stored).
 */

import { useReducer, useEffect, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { ApiError } from '@/lib/api'
import {
  wizardReducer,
  initialWizardState,
} from './backfill-wizard.reducer'
import {
  useBackfillPreview,
  useBackfillExecute,
} from './useBackfill'
import { BackfillStep1Preview } from './components/BackfillStep1Preview'
import { BackfillStep2Options } from './components/BackfillStep2Options'
import { BackfillStep3Confirmation } from './components/BackfillStep3Confirmation'
import { BackfillStep4Processing } from './components/BackfillStep4Processing'
import { BackfillStep5Complete } from './components/BackfillStep5Complete'
import './backfill-wizard.css'

const IDEMPOTENCY_KEY_SESSION = 'gst_backfill_idempotency_key'
const JOB_ID_SESSION          = 'gst_backfill_job_id'

function generateIdempotencyKey(): string {
  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 9),
  ].join('-')
}

const STEP_LABELS: Record<string, string> = {
  preview:      '1',
  options:      '2',
  confirmation: '3',
  processing:   '4',
  complete:     '5',
}

export default function BackfillWizardPage() {
  const { t } = useLanguage()
  const toast = useToast()

  const [state, dispatch] = useReducer(wizardReducer, initialWizardState)

  const previewQuery  = useBackfillPreview()
  const executeMutation = useBackfillExecute()

  // Sync preview query result into reducer
  useEffect(() => {
    if (previewQuery.isPending) {
      dispatch({ type: 'PREVIEW_START' })
    } else if (previewQuery.isError) {
      const msg =
        previewQuery.error instanceof ApiError
          ? previewQuery.error.message
          : t.backfillPreviewFailed
      dispatch({ type: 'PREVIEW_ERROR', error: msg })
    } else if (previewQuery.data) {
      dispatch({ type: 'PREVIEW_SUCCESS', preview: previewQuery.data })
    }
  }, [previewQuery.isPending, previewQuery.isError, previewQuery.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = useCallback(() => {
    previewQuery.refetch()
  }, [previewQuery])

  // Entry to step 4: generate/restore idempotency key + jobId
  const handleProceed = useCallback(async () => {
    if (state.step !== 'confirmation') return

    const { options } = state

    let idempotencyKey = sessionStorage.getItem(IDEMPOTENCY_KEY_SESSION)
    if (!idempotencyKey) {
      idempotencyKey = generateIdempotencyKey()
      sessionStorage.setItem(IDEMPOTENCY_KEY_SESSION, idempotencyKey)
    }

    const payload = {
      defaultTaxCategoryId: options.defaultTaxCategoryId,
      dateRange: [
        options.dateRange[0].toISOString().slice(0, 10),
        options.dateRange[1].toISOString().slice(0, 10),
      ] as [string, string],
      setPositionFromParty: options.setPositionFromParty,
    }

    try {
      const result = await executeMutation.mutateAsync({ payload, idempotencyKey })
      // Tolerate optimistic {} return when offline
      const jobId = result && 'jobId' in result ? result.jobId : ''
      if (jobId) {
        sessionStorage.setItem(JOB_ID_SESSION, jobId)
        dispatch({ type: 'START_PROCESSING', jobId })
      } else {
        toast.error(t.backfillStartFailed)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t.backfillStartFailed
      toast.error(msg)
    }
  }, [state, executeMutation, toast, t])

  const currentStep = STEP_LABELS[state.step] ?? '1'

  return (
    <AppShell>
      <Header
        title={t.backfillWizardTitle}
        backTo={state.step === 'processing' ? undefined : ROUTES.SETTINGS_GST}
      />
      <PageContainer>
        {/* Step indicator */}
        <div className="bfw-stepper" aria-label={t.backfillStepIndicator}>
          {['1', '2', '3', '4', '5'].map(n => (
            <div
              key={n}
              className={[
                'bfw-step-dot',
                n === currentStep ? 'bfw-step-dot--active' : '',
                Number(n) < Number(currentStep) ? 'bfw-step-dot--done' : '',
              ].join(' ')}
              aria-current={n === currentStep ? 'step' : undefined}
            />
          ))}
        </div>

        {state.step === 'preview' && (
          <BackfillStep1Preview
            loading={state.loading}
            error={state.error}
            preview={state.preview}
            onRetry={handleRetry}
            dispatch={dispatch}
          />
        )}

        {state.step === 'options' && (
          <BackfillStep2Options
            options={state.options}
            dispatch={dispatch}
          />
        )}

        {state.step === 'confirmation' && (
          <BackfillStep3Confirmation
            options={state.options}
            preview={state.preview}
            dispatch={dispatch}
            onProceed={handleProceed}
            isPending={executeMutation.isPending}
          />
        )}

        {state.step === 'processing' && (
          <BackfillStep4Processing
            jobId={state.jobId}
            dispatch={dispatch}
          />
        )}

        {state.step === 'complete' && (
          <BackfillStep5Complete
            status={state.status}
          />
        )}
      </PageContainer>
    </AppShell>
  )
}
