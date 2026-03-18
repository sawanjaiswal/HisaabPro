/** Template Gallery — Page (lazy loaded)
 *
 * Lists user's custom templates and 30 base templates organized by category.
 * Follows PartiesPage.tsx pattern: 4 UI states, FAB for create.
 */

import { useNavigate } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
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
  title: string
  templates: BaseTemplate[]
}

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    title: 'Essential',
    templates: ['A4_CLASSIC', 'A4_MODERN', 'A4_DETAILED', 'A5_COMPACT'],
  },
  {
    title: 'Modern',
    templates: ['A4_ELEGANT', 'A4_MINIMAL', 'A4_BOLD', 'A4_CORPORATE', 'A4_PROFESSIONAL', 'A4_CREATIVE'],
  },
  {
    title: 'GST & Tax',
    templates: ['A4_GST_STANDARD', 'A4_GST_DETAILED'],
  },
  {
    title: 'Indian Business',
    templates: ['A4_RETAIL', 'A4_WHOLESALE', 'A4_KIRANA', 'A4_MANUFACTURING'],
  },
  {
    title: 'Industry',
    templates: ['A4_SERVICES', 'A4_FREELANCER', 'A4_MEDICAL', 'A4_RESTAURANT', 'A4_TRANSPORT', 'A4_CONSTRUCTION'],
  },
  {
    title: 'Compact & Special',
    templates: ['A5_RECEIPT', 'A5_PROFESSIONAL', 'A4_LETTERHEAD', 'A4_TWO_COLUMN', 'A4_COLORFUL', 'A4_DARK'],
  },
  {
    title: 'Thermal Printing',
    templates: ['THERMAL_58MM', 'THERMAL_80MM'],
  },
]

export default function TemplateGalleryPage() {
  const navigate = useNavigate()
  const { templates, status, refresh } = useTemplates()

  const handleTemplateClick = (id: string) => navigate(`/settings/templates/${id}`)

  const handleBaseSelect = (base: BaseTemplate) => {
    navigate(`/settings/templates/new?base=${base}`)
  }

  return (
    <AppShell>
      <Header title="Invoice Templates" backTo={ROUTES.SETTINGS} />

      <PageContainer>
        {status === 'loading' && <TemplateGallerySkeleton />}

        {status === 'error' && (
          <ErrorState
            title="Could not load templates"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && (
          <>
            {/* User's custom templates */}
            {templates.length > 0 && (
              <section className="template-section">
                <h2 className="template-section-title">Your Templates ({templates.length})</h2>
                <div className="template-grid" role="list" aria-label="Your templates">
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
                title="No custom templates yet"
                description="Choose a template below to get started"
              />
            )}

            {/* Base templates by category */}
            {TEMPLATE_CATEGORIES.map((category) => (
              <section key={category.title} className="template-section">
                <h2 className="template-section-title">{category.title}</h2>
                <div className="template-grid" role="list" aria-label={`${category.title} templates`}>
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
        aria-label="Create new template"
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
