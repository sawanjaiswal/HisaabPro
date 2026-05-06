/** RecurringFormPage — create (/recurring/new) and edit (/recurring/:id/edit) */

import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { useRecurringForm } from '../hooks/useRecurringForm'
import { RecurringFormFields } from '../components/RecurringFormFields'
import '../recurring.css'

export default function RecurringFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const toast = useToast()

  const fromInvoiceId = searchParams.get('fromInvoiceId')
  const isEdit = Boolean(id)

  const {
    form,
    setField,
    errors,
    submit,
    isLoading,
    isError,
    isSaving,
  } = useRecurringForm({ scheduleId: id, fromInvoiceId })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!navigator.onLine) {
      toast.info(t.recurringFormOfflineToast ?? 'Saved offline — will create when reconnected.')
    }

    try {
      const resultId = await submit()
      if (resultId) {
        const msg = isEdit
          ? (t.recurringFormSuccessEdit ?? 'Schedule updated.')
          : (t.recurringFormSuccessCreate ?? 'Schedule created.')
        toast.success(msg)
        navigate(resultId ? `/recurring/${resultId}` : ROUTES.RECURRING)
      } else if (!navigator.onLine) {
        // Queued offline — go back to list
        navigate(ROUTES.RECURRING)
      }
    } catch {
      // errors handled by mutation
    }
  }

  const pageTitle = isEdit
    ? (t.recurringFormEditTitle ?? 'Edit Schedule')
    : (t.recurringFormCreateTitle ?? 'New Schedule')

  // ── Loading state (edit mode fetching existing schedule) ─────────────────

  if (isLoading) {
    return (
      <AppShell>
        <Header title={pageTitle} backTo={isEdit ? `/recurring/${id}` : ROUTES.RECURRING} />
        <PageContainer>
          <div className="recurring-skeleton" aria-busy="true" aria-label="Loading schedule">
            {(['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const).map((k) => (
              <div key={k} className="recurring-skeleton__card" />
            ))}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (isError) {
    return (
      <AppShell>
        <Header title={pageTitle} backTo={ROUTES.RECURRING} />
        <PageContainer>
          <ErrorState
            title={t.couldNotLoadRecurring ?? 'Could not load schedule'}
            message={t.checkConnectionTryAgain ?? 'Check your connection and try again.'}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <Header
        title={pageTitle}
        backTo={isEdit ? `/recurring/${id}` : ROUTES.RECURRING}
      />

      <PageContainer className="space-y-6">
        <form id="recurring-form" onSubmit={handleSubmit} noValidate>
          <RecurringFormFields
            form={form}
            errors={errors}
            setField={setField}
            disabled={isSaving}
          />

          <div className="rf-actions">
            <button
              type="button"
              className="recurring-btn recurring-btn--secondary"
              onClick={() => navigate(isEdit ? `/recurring/${id}` : ROUTES.RECURRING)}
              disabled={isSaving}
            >
              {t.recurringFormCancel ?? 'Cancel'}
            </button>
            <button
              type="submit"
              className="recurring-btn recurring-btn--primary"
              disabled={isSaving}
              aria-busy={isSaving}
            >
              {isSaving
                ? (t.recurringFormSaving ?? 'Saving...')
                : (t.recurringFormSave ?? 'Save Schedule')}
            </button>
          </div>
        </form>
      </PageContainer>
    </AppShell>
  )
}
