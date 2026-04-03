/** Create Party — Page (lazy loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { usePartyForm } from './usePartyForm'
import { PartyFormBasic } from './components/PartyFormBasic'
import { PartyFormBusiness } from './components/PartyFormBusiness'
import { PartyFormCredit } from './components/PartyFormCredit'
import './create-party.css'

type SectionId = 'basic' | 'business' | 'credit'

export default function CreatePartyPage() {
  const { t } = useLanguage()

  const SECTIONS: { id: SectionId; label: string }[] = [
    { id: 'basic', label: t.basicInfo },
    { id: 'business', label: t.business2 },
    { id: 'credit', label: t.credit },
  ]
  const {
    form,
    errors,
    isSubmitting,
    activeSection,
    setActiveSection,
    updateField,
    handleSubmit,
    reset,
    gstinVerify,
  } = usePartyForm()

  const handleSaveAndAddAnother = async () => {
    await handleSubmit()
    reset()
    setActiveSection('basic')
  }

  return (
    <AppShell>
      <Header title={t.newParty} backTo={ROUTES.PARTIES} />

      <PageContainer className="create-party-page stagger-enter">
        <nav className="pill-tabs" role="tablist" aria-label={t.formSections}>
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
            <PartyFormBusiness form={form} errors={errors} onUpdate={updateField} gstinVerify={gstinVerify} />
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
