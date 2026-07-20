/** Create Party — Page (lazy loaded)
 *
 * Mockup #6 (Add Customer) is one continuous scroll rather than pill tabs;
 * the body lives in <PartyFormSections> so Edit renders the same thing.
 */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { usePartyForm } from './usePartyForm'
import { PartyFormSections } from './components/PartyFormSections'
import './create-party.css'

export default function CreatePartyPage() {
  const { t } = useLanguage()
  const {
    form,
    errors,
    isSubmitting,
    updateField,
    handleSubmit,
    reset,
    gstinVerify,
  } = usePartyForm()

  const handleSaveAndAddAnother = async () => {
    await handleSubmit()
    reset()
  }

  return (
    <AppShell>
      <Header title={t.newParty} backTo={ROUTES.PARTIES} />

      <PageContainer className="create-party-page stagger-enter space-y-6">
        <PartyFormSections
          form={form}
          errors={errors}
          onUpdate={updateField}
          gstinVerify={gstinVerify}
        />
      </PageContainer>

      <div className="create-party-actions">
        <Button
          variant="primary"
          size="lg"
          loading={isSubmitting}
          onClick={handleSubmit}
          aria-label={t.savePartyLabel}
        >
          {t.saveParty}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          className="create-party-save-another"
          onClick={handleSaveAndAddAnother}
          disabled={isSubmitting}
          aria-label={t.saveAndAddAnotherLabel}
        >
          {t.saveAndAddAnother}
        </Button>
      </div>
    </AppShell>
  )
}
