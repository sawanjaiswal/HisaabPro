/** Template Editor — Page (lazy loaded)
 *
 * Split-view: live preview (top) + customization controls (bottom).
 * Follows CreatePartyPage.tsx pattern with pill tabs for sections.
 */

import { useCallback } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { ROUTES } from '@/config/routes.config'
import { useTemplateForm } from './useTemplateForm'
import { TemplatePreviewPanel } from './components/TemplatePreviewPanel'
import { TemplateControlPanel } from './components/TemplateControlPanel'
import type { TemplateConfig, PrintSettings } from './template.types'
import './template-preview.css'
import './template-controls.css'
import './template-actions.css'

export default function TemplateEditorPage() {
  const { t } = useLanguage()
  const {
    form,
    isSubmitting,
    activeTab,
    setActiveTab,
    updateConfig,
    updatePrintSetting,
    handleSubmit,
  } = useTemplateForm()

  /** Adapter: ControlPanel sends Partial<TemplateConfig>, hook takes (section, value) */
  const handleConfigChange = useCallback((patch: Partial<TemplateConfig>) => {
    for (const key of Object.keys(patch) as Array<keyof TemplateConfig>) {
      const value = patch[key]
      if (value !== undefined) {
        updateConfig(key, value as TemplateConfig[typeof key])
      }
    }
  }, [updateConfig])

  /** Adapter: ControlPanel sends Partial<PrintSettings>, hook takes (key, value) */
  const handlePrintSettingsChange = useCallback((patch: Partial<PrintSettings>) => {
    for (const key of Object.keys(patch) as Array<keyof PrintSettings>) {
      const value = patch[key]
      if (value !== undefined) {
        updatePrintSetting(key, value as PrintSettings[typeof key])
      }
    }
  }, [updatePrintSetting])

  return (
    <AppShell>
      <Header
        title={form.name || t.newTemplate}
        backTo={ROUTES.TEMPLATES}
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            aria-label={isSubmitting ? t.savingTemplate : t.saveTemplate}
          >
            {isSubmitting ? t.saving : t.save}
          </button>
        }
      />

      <div className="template-customize-page stagger-enter">
        <div className="template-preview-panel">
          <TemplatePreviewPanel config={form.config} printSettings={form.printSettings} />
        </div>

        <div className="template-controls-panel">
          <TemplateControlPanel
            activeTab={activeTab}
            config={form.config}
            printSettings={form.printSettings}
            onTabChange={setActiveTab}
            onConfigChange={handleConfigChange}
            onPrintSettingsChange={handlePrintSettingsChange}
          />
        </div>
      </div>
    </AppShell>
  )
}
