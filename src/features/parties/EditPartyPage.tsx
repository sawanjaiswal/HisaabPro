/** Edit Party — Page (lazy loaded)
 *
 * Fetches existing party data, converts PartyDetail → PartyFormData,
 * then reuses the same form components as CreatePartyPage.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { usePartyForm } from './usePartyForm'
import { getParty } from './party.service'
import { paiseToRupeesNum } from './party.utils'
import { PartyFormBasic } from './components/PartyFormBasic'
import { PartyFormBusiness } from './components/PartyFormBusiness'
import { PartyFormCredit } from './components/PartyFormCredit'
import type { PartyFormData, PartyDetail } from './party.types'
import './create-party.css'

type SectionId = 'basic' | 'business' | 'credit'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'business', label: 'Business' },
  { id: 'credit', label: 'Credit' },
]

/** Convert server PartyDetail → form-compatible PartyFormData */
function detailToFormData(detail: PartyDetail): PartyFormData {
  return {
    name: detail.name,
    phone: detail.phone,
    email: detail.email,
    companyName: detail.companyName,
    type: detail.type,
    groupId: detail.group?.id ?? null,
    tags: detail.tags,
    gstin: detail.gstin,
    pan: detail.pan,
    creditLimit: detail.creditLimit / 100, // paise → rupees for form
    creditLimitMode: detail.creditLimitMode,
    notes: detail.notes,
    addresses: detail.addresses.map(({ id: _id, ...rest }) => rest),
    openingBalance: detail.openingBalance
      ? {
          ...detail.openingBalance,
          amount: paiseToRupeesNum(detail.openingBalance.amount),
        }
      : undefined,
  }
}

export default function EditPartyPage() {
  const { id } = useParams<{ id: string }>()
  const partyId = id ?? ''

  const [loadStatus, setLoadStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [initialData, setInitialData] = useState<PartyFormData | undefined>()

  useEffect(() => {
    const controller = new AbortController()
    setLoadStatus('loading')

    getParty(partyId, controller.signal)
      .then((detail) => {
        setInitialData(detailToFormData(detail))
        setLoadStatus('ready')
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setLoadStatus('error')
      })

    return () => controller.abort()
  }, [partyId])

  if (loadStatus === 'loading') {
    return (
      <AppShell>
        <Header title="Edit Party" backTo={`/parties/${partyId}`} />
        <PageContainer>
          <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton height="3.5rem" borderRadius="var(--radius-md)" count={5} />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (loadStatus === 'error' || !initialData) {
    return (
      <AppShell>
        <Header title="Edit Party" backTo={`/parties/${partyId}`} />
        <PageContainer>
          <ErrorState
            title="Could not load party"
            message="Check your connection and try again."
            onRetry={() => window.location.reload()}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return <EditPartyForm partyId={partyId} initialData={initialData} />
}

/** Inner component — only renders when data is loaded */
function EditPartyForm({ partyId, initialData }: { partyId: string; initialData: PartyFormData }) {
  const {
    form,
    errors,
    isSubmitting,
    activeSection,
    setActiveSection,
    updateField,
    handleSubmit,
  } = usePartyForm({ editId: partyId, initialData })

  return (
    <AppShell>
      <Header title="Edit Party" backTo={`/parties/${partyId}`} />

      <PageContainer className="create-party-page">
        <nav className="pill-tabs" role="tablist" aria-label="Form sections">
          {SECTIONS.map(section => (
            <button
              key={section.id}
              type="button"
              role="tab"
              className={`pill-tab${activeSection === section.id ? ' active' : ''}`}
              onClick={() => setActiveSection(section.id)}
              aria-selected={activeSection === section.id}
              aria-controls={`section-panel-${section.id}`}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div
          id={`section-panel-${activeSection}`}
          role="tabpanel"
          aria-label={SECTIONS.find(s => s.id === activeSection)?.label}
        >
          {activeSection === 'basic' && (
            <PartyFormBasic form={form} errors={errors} onUpdate={updateField} />
          )}
          {activeSection === 'business' && (
            <PartyFormBusiness form={form} errors={errors} onUpdate={updateField} />
          )}
          {activeSection === 'credit' && (
            <PartyFormCredit form={form} errors={errors} onUpdate={updateField} />
          )}
        </div>
      </PageContainer>

      <div className="create-party-actions">
        <Button
          variant="primary"
          size="lg"
          loading={isSubmitting}
          onClick={handleSubmit}
          aria-label="Update party"
        >
          Update Party
        </Button>
      </div>
    </AppShell>
  )
}
