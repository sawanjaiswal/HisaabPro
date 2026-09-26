/** Create Party — Page (lazy loaded)
 *
 * Mockup #6 (Add Customer) is one continuous scroll rather than pill tabs;
 * the body lives in <PartyFormSections> so Edit renders the same thing.
 */

import { FormPageShell } from '@/components/layout/FormPageShell'
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
    <FormPageShell
      title={t.newParty}
      backTo={ROUTES.PARTIES}
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveAndAddAnother}
            disabled={isSubmitting}
            aria-label={t.saveAndAddAnotherLabel}
          >
            {t.saveAndAddAnother}
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            onClick={handleSubmit}
            aria-label={t.savePartyLabel}
          >
            {t.saveParty}
          </Button>
        </>
      }
    >
      <PartyFormSections
        form={form}
        errors={errors}
        onUpdate={updateField}
        gstinVerify={gstinVerify}
      />
    </FormPageShell>
  )
}
