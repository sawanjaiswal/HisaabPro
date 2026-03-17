/** Template editor control panel — tab-driven customisation controls */

import React from 'react'

import type { CustomizationTab, TemplateConfig, PrintSettings } from '../template.types'
import { CUSTOMIZATION_TAB_LABELS } from '../template.constants'

import { LayoutTab } from './LayoutTab'
import { ColumnsTab } from './ColumnsTab'
import { FieldsTab } from './FieldsTab'
import { StyleTab } from './StyleTab'
import { TextTab } from './TextTab'
import { PrintTab } from './PrintTab'

const CUSTOMIZATION_TABS: CustomizationTab[] = ['layout', 'columns', 'fields', 'style', 'text', 'print']

interface TemplateControlPanelProps {
  activeTab: CustomizationTab
  config: TemplateConfig
  printSettings: PrintSettings
  onTabChange: (tab: CustomizationTab) => void
  onConfigChange: (patch: Partial<TemplateConfig>) => void
  onPrintSettingsChange: (patch: Partial<PrintSettings>) => void
}

export const TemplateControlPanel: React.FC<TemplateControlPanelProps> = ({
  activeTab,
  config,
  printSettings,
  onTabChange,
  onConfigChange,
  onPrintSettingsChange,
}) => {
  return (
    <div className="template-controls-panel">
      {/* Tab pills */}
      <nav className="template-controls-tabs" aria-label="Template customisation sections" role="tablist">
        {CUSTOMIZATION_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className={`template-controls-tab${activeTab === tab ? ' active' : ''}`}
            aria-selected={activeTab === tab}
            aria-label={CUSTOMIZATION_TAB_LABELS[tab]}
            onClick={() => onTabChange(tab)}
          >
            {CUSTOMIZATION_TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      {/* Active tab content */}
      <div
        className="template-controls-body"
        role="tabpanel"
        aria-label={`${CUSTOMIZATION_TAB_LABELS[activeTab]} settings`}
      >
        {activeTab === 'layout'  && <LayoutTab  config={config} onChange={onConfigChange} />}
        {activeTab === 'columns' && <ColumnsTab config={config} onChange={onConfigChange} />}
        {activeTab === 'fields'  && <FieldsTab  config={config} onChange={onConfigChange} />}
        {activeTab === 'style'   && <StyleTab   config={config} onChange={onConfigChange} />}
        {activeTab === 'text'    && <TextTab    config={config} onChange={onConfigChange} />}
        {activeTab === 'print'   && <PrintTab   printSettings={printSettings} onChange={onPrintSettingsChange} />}
      </div>
    </div>
  )
}
