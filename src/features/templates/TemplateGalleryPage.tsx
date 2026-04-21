/** Template Gallery — Page (lazy loaded)
 *
 * Lists user's custom templates and 30 base templates organized by category.
 * Follows PartiesPage.tsx pattern: 4 UI states, FAB for create.
 */

import { useNavigate } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useTemplates } from './useTemplates'
import { TemplateCard } from './components/TemplateCard'
import { BaseTemplateCard } from './components/BaseTemplateCard'
import { TemplateGallerySkeleton } from './components/TemplateGallerySkeleton'
import type { BaseTemplate } from './template.types'
import './templates.css'

interface TemplateCategory {
  titleKey: 'essential' | 'modernCategory' | 'gstAndTax' | 'indianBusiness' | 'industryCategory' | 'compactAndSpecial' | 'thermalPrinting'
  templates: BaseTemplate[]
}

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    titleKey: 'essential',
    templates: ['A4_CLASSIC', 'A4_MODERN', 'A4_DETAILED', 'A5_COMPACT'],
  },
  {
    titleKey: 'modernCategory',
    templates: ['A4_ELEGANT', 'A4_MINIMAL', 'A4_BOLD', 'A4_CORPORATE', 'A4_PROFESSIONAL', 'A4_CREATIVE'],
  },
  {
    titleKey: 'gstAndTax',
    templates: ['A4_GST_STANDARD', 'A4_GST_DETAILED'],
  },
  {
    titleKey: 'indianBusiness',
    templates: ['A4_RETAIL', 'A4_WHOLESALE', 'A4_KIRANA', 'A4_MANUFACTURING'],
  },
  {
    titleKey: 'industryCategory',
    templates: ['A4_SERVICES', 'A4_FREELANCER', 'A4_MEDICAL', 'A4_RESTAURANT', 'A4_TRANSPORT', 'A4_CONSTRUCTION'],
  },
  {
    titleKey: 'compactAndSpecial',
    templates: ['A5_RECEIPT', 'A5_PROFESSIONAL', 'A4_LETTERHEAD', 'A4_TWO_COLUMN', 'A4_COLORFUL', 'A4_DARK'],
  },
  {
    titleKey: 'thermalPrinting',
    templates: ['THERMAL_58MM', 'THERMAL_80MM'],
  },
]

export default function TemplateGalleryPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { templates, status, refresh } = useTemplates()

  const handleTemplateClick = (id: string) => navigate(`/settings/templates/${id}`)

  const handleBaseSelect = (base: BaseTemplate) => {
    navigate(`/settings/templates/new?base=${base}`)
  }

  return (
    <AppShell>
      <Header title={t.invoiceTemplates} backTo={ROUTES.SETTINGS} />

      <PageContainer className="space-y-6">
        {status === 'loading' && <TemplateGallerySkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadTemplates}
            message={t.checkConnectionTryAgain}
            onRetry={refresh}
          />
        )}

        {status === 'success' && (
          <>
            {/* User's custom templates */}
            {templates.length > 0 && (
              <section className="template-section py-0">
                <h2 className="template-section-title py-0">{t.yourTemplates} ({templates.length})</h2>
                <div className="template-grid stagger-list" role="list" aria-label={t.yourTemplates}>
                  {templates.map((template) => (
                    <div key={template.id} role="listitem">
                      <TemplateCard template={template} onClick={handleTemplateClick} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {templates.length === 0 && (
              <EmptyState
                icon={<FileText size={40} aria-hidden="true" />}
                title={t.noCustomTemplatesYet}
                description={t.chooseTemplateBelow}
              />
            )}

            {/* Base templates by category */}
            {TEMPLATE_CATEGORIES.map((category) => (
              <section key={category.titleKey} className="template-section py-0">
                <h2 className="template-section-title py-0">{t[category.titleKey]}</h2>
                <div className="template-grid" role="list" aria-label={`${t[category.titleKey]} ${t.templatesAriaLabel}`}>
                  {category.templates.map((base) => (
                    <div key={base} role="listitem">
                      <BaseTemplateCard baseTemplate={base} onSelect={handleBaseSelect} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </PageContainer>

      <button
        className="fab"
        onClick={() => navigate('/settings/templates/new?base=A4_CLASSIC')}
        aria-label={t.createNewTemplate}
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
