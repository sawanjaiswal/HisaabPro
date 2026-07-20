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
import { useLanguage } from '@/hooks/useLanguage'
import { usePartyForm } from './usePartyForm'
import { getParty } from './party.service'
import { paiseToRupeesNum } from './party.utils'
import { PartyFormSections } from './components/PartyFormSections'
import { usePresence } from '@/features/collaboration/usePresence'
import { PresenceAvatars } from '@/features/collaboration/PresenceAvatars'
import { ConflictDialog } from '@/features/collaboration/ConflictDialog'
import type { PartyFormData, PartyDetail } from './party.types'
import './create-party.css'

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
    gstinVerified: detail.gstinVerified,
    gstinLegalName: detail.gstinLegalName,
    gstinStatus: detail.gstinStatus,
    creditLimit: detail.creditLimit / 100, // paise → rupees for form
    creditLimitMode: detail.creditLimitMode,
    notes: detail.notes,
    addresses: detail.addresses.map(({ id: _id, ...rest }) => rest),
    customFields: (detail.customFieldValues ?? []).map(cv => ({ fieldId: cv.fieldId, value: cv.value })),
    openingBalance: detail.openingBalance
      ? {
          ...detail.openingBalance,
          amount: paiseToRupeesNum(detail.openingBalance.amount),
        }
      : undefined,
    priceListId: detail.priceListId ?? null,
  }
}

export default function EditPartyPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const partyId = id ?? ''

  const [loadStatus, setLoadStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [initialData, setInitialData] = useState<PartyFormData | undefined>()
  const [version, setVersion] = useState<number | undefined>()

  useEffect(() => {
    const controller = new AbortController()
    setLoadStatus('loading')

    getParty(partyId, controller.signal)
      .then((detail) => {
        setInitialData(detailToFormData(detail))
        setVersion(detail.version)
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
        <Header title={t.editParty} backTo={`/parties/${partyId}`} />
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
        <Header title={t.editParty} backTo={`/parties/${partyId}`} />
        <PageContainer>
          <ErrorState
            title={t.couldNotLoadParty}
            message={t.checkConnectionRetry}
            onRetry={() => window.location.reload()}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return <EditPartyForm partyId={partyId} initialData={initialData} version={version} />
}

/** Inner component — only renders when data is loaded */
function EditPartyForm({ partyId, initialData, version }: { partyId: string; initialData: PartyFormData; version?: number }) {
  const { t } = useLanguage()
  const {
    form,
    errors,
    isSubmitting,
    updateField,
    handleSubmit,
    gstinVerify,
    conflictReconcile,
  } = usePartyForm({ editId: partyId, initialData, version })

  // #150 — advertise this user as editing the party; show co-editors.
  const { peers } = usePresence('party', partyId, 'editing')

  return (
    <AppShell>
      <Header title={t.editParty} backTo={`/parties/${partyId}`} actions={<PresenceAvatars peers={peers} />} />

      <PageContainer className="create-party-page stagger-enter space-y-6">
        <PartyFormSections
          form={form}
          errors={errors}
          onUpdate={updateField}
          gstinVerify={gstinVerify}
          isEditMode
        />
      </PageContainer>

      <div className="create-party-actions">
        <Button
          variant="primary"
          size="lg"
          loading={isSubmitting}
          onClick={handleSubmit}
          aria-label={t.updatePartyLabel}
        >
          {t.updatePartyText}
        </Button>
      </div>

      <ConflictDialog
        conflict={conflictReconcile.conflict}
        overwriting={conflictReconcile.overwriting}
        onReload={conflictReconcile.reload}
        onOverwrite={conflictReconcile.overwrite}
        onDismiss={conflictReconcile.dismiss}
      />
    </AppShell>
  )
}
