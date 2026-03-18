/** Create Party — Page (lazy loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { usePartyForm } from './usePartyForm'
import { PartyFormBasic } from './components/PartyFormBasic'
import { PartyFormBusiness } from './components/PartyFormBusiness'
import { PartyFormCredit } from './components/PartyFormCredit'
import './create-party.css'

type SectionId = 'basic' | 'business' | 'credit'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'business', label: 'Business' },
  { id: 'credit', label: 'Credit' },
]

export default function CreatePartyPage() {
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
      <Header title="New Party" backTo={ROUTES.PARTIES} />

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
          aria-label="Save party"
        >
          Save Party
        </Button>
        <button
          type="button"
          className="create-party-save-another"
          onClick={handleSaveAndAddAnother}
          disabled={isSubmitting}
          aria-label="Save party and add another"
        >
          Save &amp; Add Another
        </button>
      </div>
    </AppShell>
  )
}
