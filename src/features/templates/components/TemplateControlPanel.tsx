/** Template editor control panel — tab-driven customisation controls */

import React from 'react'
import type {
  CustomizationTab,
  TemplateConfig,
  PrintSettings,
  LogoPosition,
  HeaderStyle,
  ItemTableStyle,
  SummaryPosition,
  TemplateFontFamily,
  TemplateFontSize,
  PageSize,
  PageOrientation,
  PageMargins,
} from '../template.types'
import {
  CUSTOMIZATION_TAB_LABELS,
  LOGO_POSITION_LABELS,
  HEADER_STYLE_LABELS,
  TABLE_STYLE_LABELS,
  SUMMARY_POSITION_LABELS,
  FONT_FAMILY_LABELS,
  FONT_SIZE_LABELS,
  PAGE_SIZE_LABELS,
  ORIENTATION_LABELS,
  MARGINS_LABELS,
  COLOR_PRESETS,
  COLUMN_ORDER,
  MAX_HEADER_TEXT_LENGTH,
  MAX_FOOTER_TEXT_LENGTH,
  MAX_TERMS_TEXT_LENGTH,
  MAX_COPIES,
} from '../template.constants'

const CUSTOMIZATION_TABS: CustomizationTab[] = ['layout', 'columns', 'fields', 'style', 'text', 'print']

/** Required columns that can never be hidden */
const LOCKED_COLUMNS = new Set<keyof TemplateConfig['columns']>(['itemName', 'quantity', 'rate', 'amount'])

interface TemplateControlPanelProps {
  activeTab: CustomizationTab
  config: TemplateConfig
  printSettings: PrintSettings
  onTabChange: (tab: CustomizationTab) => void
  onConfigChange: (patch: Partial<TemplateConfig>) => void
  onPrintSettingsChange: (patch: Partial<PrintSettings>) => void
}

// ─── Segmented control helper ────────────────────────────────────────────────

interface SegmentedControlProps<T extends string> {
  value: T
  options: T[]
  labels: Record<T, string>
  ariaLabel: string
  onChange: (value: T) => void
}

function SegmentedControl<T extends string>({
  value,
  options,
  labels,
  ariaLabel,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="template-segmented-control" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`template-segmented-btn${value === opt ? ' active' : ''}`}
          aria-pressed={value === opt}
          aria-label={labels[opt]}
          onClick={() => onChange(opt)}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}

// ─── Toggle row helper ───────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string
  sublabel?: string
  checked: boolean
  disabled?: boolean
  ariaLabel: string
  onChange: (checked: boolean) => void
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, sublabel, checked, disabled, ariaLabel, onChange }) => (
  <div className="template-toggle-row">
    <div className="template-toggle-info">
      <span className="template-control-label">{label}</span>
      {sublabel && <span className="template-control-sublabel">{sublabel}</span>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 'var(--radius-full)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--color-primary-600)' : 'var(--color-gray-300)',
        position: 'relative',
        flexShrink: 0,
        transition: 'background var(--duration-fast) var(--ease-default)',
        opacity: disabled ? 0.5 : 1,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        padding: '0 3px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--color-gray-0)',
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform var(--duration-fast) var(--ease-default)',
          boxShadow: 'var(--shadow-xs)',
        }}
      />
    </button>
  </div>
)

// ─── Control row helper ───────────────────────────────────────────────────────

interface ControlRowProps {
  label: string
  children: React.ReactNode
}

const ControlRow: React.FC<ControlRowProps> = ({ label, children }) => (
  <div className="template-control-row">
    <span className="template-control-label">{label}</span>
    {children}
  </div>
)

// ─── Section wrapper ─────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  children: React.ReactNode
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div className="template-control-section">
    <div className="template-control-section-title">{title}</div>
    {children}
  </div>
)

// ─── Tab content panels ───────────────────────────────────────────────────────

const LayoutTab: React.FC<{ config: TemplateConfig; onChange: TemplateControlPanelProps['onConfigChange'] }> = ({ config, onChange }) => (
  <>
    <Section title="Header">
      <ControlRow label="Logo Position">
        <SegmentedControl<LogoPosition>
          value={config.layout.logoPosition}
          options={['left', 'center', 'right', 'none']}
          labels={LOGO_POSITION_LABELS}
          ariaLabel="Logo position"
          onChange={(v) => onChange({ layout: { ...config.layout, logoPosition: v } })}
        />
      </ControlRow>
      <ControlRow label="Header Style">
        <SegmentedControl<HeaderStyle>
          value={config.layout.headerStyle}
          options={['stacked', 'side-by-side', 'minimal']}
          labels={HEADER_STYLE_LABELS}
          ariaLabel="Header style"
          onChange={(v) => onChange({ layout: { ...config.layout, headerStyle: v } })}
        />
      </ControlRow>
    </Section>

    <Section title="Table">
      <ControlRow label="Table Style">
        <SegmentedControl<ItemTableStyle>
          value={config.layout.itemTableStyle}
          options={['bordered', 'striped', 'minimal']}
          labels={TABLE_STYLE_LABELS}
          ariaLabel="Table style"
          onChange={(v) => onChange({ layout: { ...config.layout, itemTableStyle: v } })}
        />
      </ControlRow>
      <ControlRow label="Summary Position">
        <SegmentedControl<SummaryPosition>
          value={config.layout.summaryPosition}
          options={['right', 'center', 'full-width']}
          labels={SUMMARY_POSITION_LABELS}
          ariaLabel="Summary position"
          onChange={(v) => onChange({ layout: { ...config.layout, summaryPosition: v } })}
        />
      </ControlRow>
    </Section>
  </>
)

const ColumnsTab: React.FC<{ config: TemplateConfig; onChange: TemplateControlPanelProps['onConfigChange'] }> = ({ config, onChange }) => (
  <Section title="Line Item Columns">
    {COLUMN_ORDER.map((key) => {
      const col = config.columns[key]
      const isLocked = LOCKED_COLUMNS.has(key)
      return (
        <ToggleRow
          key={key}
          label={col.label}
          sublabel={isLocked ? 'Required — cannot be hidden' : undefined}
          checked={col.visible}
          disabled={isLocked}
          ariaLabel={`${isLocked ? 'Required column' : 'Toggle column'}: ${col.label}`}
          onChange={(checked) =>
            onChange({
              columns: {
                ...config.columns,
                [key]: { ...col, visible: checked },
              },
            })
          }
        />
      )
    })}
  </Section>
)

const FieldsTab: React.FC<{ config: TemplateConfig; onChange: TemplateControlPanelProps['onConfigChange'] }> = ({ config, onChange }) => {
  const f = config.fields
  const patchFields = (patch: Partial<typeof f>) => onChange({ fields: { ...f, ...patch } })

  return (
    <>
      <Section title="Business Info">
        <ToggleRow label="GSTIN"            checked={f.businessGstin}   ariaLabel="Show business GSTIN"    onChange={(v) => patchFields({ businessGstin: v })} />
        <ToggleRow label="PAN"              checked={f.businessPan}     ariaLabel="Show business PAN"      onChange={(v) => patchFields({ businessPan: v })} />
        <ToggleRow label="Phone"            checked={f.businessPhone}   ariaLabel="Show business phone"    onChange={(v) => patchFields({ businessPhone: v })} />
        <ToggleRow label="Email"            checked={f.businessEmail}   ariaLabel="Show business email"    onChange={(v) => patchFields({ businessEmail: v })} />
        <ToggleRow label="Address"          checked={f.businessAddress} ariaLabel="Show business address"  onChange={(v) => patchFields({ businessAddress: v })} />
      </Section>

      <Section title="Customer Info">
        <ToggleRow label="Customer GSTIN"   checked={f.customerGstin}   ariaLabel="Show customer GSTIN"    onChange={(v) => patchFields({ customerGstin: v })} />
        <ToggleRow label="Customer Phone"   checked={f.customerPhone}   ariaLabel="Show customer phone"    onChange={(v) => patchFields({ customerPhone: v })} />
        <ToggleRow label="Billing Address"  checked={f.customerAddress} ariaLabel="Show billing address"   onChange={(v) => patchFields({ customerAddress: v })} />
        <ToggleRow label="Shipping Address" checked={f.shippingAddress} ariaLabel="Show shipping address"  onChange={(v) => patchFields({ shippingAddress: v })} />
        <ToggleRow label="Place of Supply"  checked={f.placeOfSupply}   ariaLabel="Show place of supply"   onChange={(v) => patchFields({ placeOfSupply: v })} />
      </Section>

      <Section title="Document Details">
        <ToggleRow label="Invoice Number"    checked={f.invoiceNumber}      ariaLabel="Show invoice number"     onChange={(v) => patchFields({ invoiceNumber: v })} />
        <ToggleRow label="Invoice Date"      checked={f.invoiceDate}        ariaLabel="Show invoice date"       onChange={(v) => patchFields({ invoiceDate: v })} />
        <ToggleRow label="Due Date"          checked={f.dueDate}            ariaLabel="Show due date"           onChange={(v) => patchFields({ dueDate: v })} />
        <ToggleRow label="PO Number"         checked={f.poNumber}           ariaLabel="Show PO number"          onChange={(v) => patchFields({ poNumber: v })} />
        <ToggleRow label="Vehicle Number"    checked={f.vehicleNumber}      ariaLabel="Show vehicle number"     onChange={(v) => patchFields({ vehicleNumber: v })} />
        <ToggleRow label="Transport Details" checked={f.transportDetails}   ariaLabel="Show transport details"  onChange={(v) => patchFields({ transportDetails: v })} />
      </Section>

      <Section title="Footer">
        <ToggleRow label="Bank Details"        checked={f.bankDetails}          ariaLabel="Show bank details"          onChange={(v) => patchFields({ bankDetails: v })} />
        <ToggleRow label="Signature"           checked={f.signature}            ariaLabel="Show signature block"       onChange={(v) => patchFields({ signature: v })} />
        <ToggleRow label="Terms & Conditions"  checked={f.termsAndConditions}   ariaLabel="Show terms and conditions"  onChange={(v) => patchFields({ termsAndConditions: v })} />
        <ToggleRow label="Notes"               checked={f.notes}                ariaLabel="Show notes"                 onChange={(v) => patchFields({ notes: v })} />
        <ToggleRow label="Total in Words"      checked={f.totalInWords}         ariaLabel="Show total in words"        onChange={(v) => patchFields({ totalInWords: v })} />
        <ToggleRow label="QR Code"             checked={f.qrCode}               ariaLabel="Show QR code"               onChange={(v) => patchFields({ qrCode: v })} />
        <ToggleRow label="Watermark"           checked={f.watermark}            ariaLabel="Show watermark"             onChange={(v) => patchFields({ watermark: v })} />
      </Section>
    </>
  )
}

const StyleTab: React.FC<{ config: TemplateConfig; onChange: TemplateControlPanelProps['onConfigChange'] }> = ({ config, onChange }) => {
  const { typography, colors } = config

  return (
    <>
      <Section title="Typography">
        <ControlRow label="Font Family">
          <SegmentedControl<TemplateFontFamily>
            value={typography.fontFamily}
            options={['inter', 'noto-sans', 'roboto', 'poppins']}
            labels={FONT_FAMILY_LABELS}
            ariaLabel="Font family"
            onChange={(v) => onChange({ typography: { ...typography, fontFamily: v } })}
          />
        </ControlRow>
        <ControlRow label="Font Size">
          <SegmentedControl<TemplateFontSize>
            value={typography.fontSize}
            options={['small', 'medium', 'large']}
            labels={FONT_SIZE_LABELS}
            ariaLabel="Font size"
            onChange={(v) => onChange({ typography: { ...typography, fontSize: v } })}
          />
        </ControlRow>
      </Section>

      <Section title="Accent Colour">
        <div className="template-color-swatches" role="group" aria-label="Accent colour presets">
          {COLOR_PRESETS.map(({ name, hex }) => (
            <button
              key={hex}
              type="button"
              className={`template-color-swatch${colors.accent === hex ? ' active' : ''}`}
              aria-label={`${name} (${hex})`}
              aria-pressed={colors.accent === hex}
              style={{ backgroundColor: hex }}
              onClick={() =>
                onChange({
                  colors: {
                    ...colors,
                    accent: hex,
                    headerBg: hex,
                  },
                })
              }
            />
          ))}
        </div>
      </Section>
    </>
  )
}

const TextTab: React.FC<{ config: TemplateConfig; onChange: TemplateControlPanelProps['onConfigChange'] }> = ({ config, onChange }) => (
  <Section title="Custom Text">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <label
          htmlFor="template-header-text"
          style={{ display: 'block', fontSize: '0.833rem', fontWeight: 500, color: 'var(--color-gray-700)', marginBottom: 'var(--space-2)' }}
        >
          Header Text
        </label>
        <input
          id="template-header-text"
          type="text"
          className="input"
          value={config.headerText}
          maxLength={MAX_HEADER_TEXT_LENGTH}
          placeholder="e.g. || Shree Ganeshay Namah ||"
          aria-label="Header text printed above the invoice title"
          onChange={(e) => onChange({ headerText: e.target.value })}
        />
        <span style={{ fontSize: '0.694rem', color: 'var(--color-gray-400)', marginTop: '4px', display: 'block' }}>
          {config.headerText.length}/{MAX_HEADER_TEXT_LENGTH}
        </span>
      </div>

      <div>
        <label
          htmlFor="template-footer-text"
          style={{ display: 'block', fontSize: '0.833rem', fontWeight: 500, color: 'var(--color-gray-700)', marginBottom: 'var(--space-2)' }}
        >
          Footer Text
        </label>
        <input
          id="template-footer-text"
          type="text"
          className="input"
          value={config.footerText}
          maxLength={MAX_FOOTER_TEXT_LENGTH}
          placeholder="e.g. Thank you for your business!"
          aria-label="Footer text printed at the bottom of the invoice"
          onChange={(e) => onChange({ footerText: e.target.value })}
        />
        <span style={{ fontSize: '0.694rem', color: 'var(--color-gray-400)', marginTop: '4px', display: 'block' }}>
          {config.footerText.length}/{MAX_FOOTER_TEXT_LENGTH}
        </span>
      </div>

      <div>
        <label
          htmlFor="template-terms-text"
          style={{ display: 'block', fontSize: '0.833rem', fontWeight: 500, color: 'var(--color-gray-700)', marginBottom: 'var(--space-2)' }}
        >
          Default Terms & Conditions
        </label>
        <textarea
          id="template-terms-text"
          className="input"
          value={config.termsText}
          maxLength={MAX_TERMS_TEXT_LENGTH}
          rows={4}
          placeholder="Enter default terms pre-filled on new invoices…"
          aria-label="Default terms and conditions pre-filled on new invoices"
          onChange={(e) => onChange({ termsText: e.target.value })}
          style={{ resize: 'vertical', minHeight: '96px' }}
        />
        <span style={{ fontSize: '0.694rem', color: 'var(--color-gray-400)', marginTop: '4px', display: 'block' }}>
          {config.termsText.length}/{MAX_TERMS_TEXT_LENGTH}
        </span>
      </div>
    </div>
  </Section>
)

const PrintTab: React.FC<{
  printSettings: PrintSettings
  onChange: TemplateControlPanelProps['onPrintSettingsChange']
}> = ({ printSettings, onChange }) => (
  <>
    <Section title="Page">
      <ControlRow label="Page Size">
        <select
          className="input"
          value={printSettings.pageSize}
          aria-label="Page size"
          onChange={(e) => onChange({ pageSize: e.target.value as PageSize })}
          style={{ minHeight: 44 }}
        >
          {(Object.keys(PAGE_SIZE_LABELS) as PageSize[]).map((size) => (
            <option key={size} value={size}>{PAGE_SIZE_LABELS[size]}</option>
          ))}
        </select>
      </ControlRow>

      <ControlRow label="Orientation">
        <SegmentedControl<PageOrientation>
          value={printSettings.orientation}
          options={['portrait', 'landscape']}
          labels={ORIENTATION_LABELS}
          ariaLabel="Page orientation"
          onChange={(v) => onChange({ orientation: v })}
        />
      </ControlRow>

      <ControlRow label="Margins">
        <SegmentedControl<PageMargins>
          value={printSettings.margins}
          options={['normal', 'narrow', 'wide', 'none']}
          labels={MARGINS_LABELS}
          ariaLabel="Page margins"
          onChange={(v) => onChange({ margins: v })}
        />
      </ControlRow>
    </Section>

    <Section title="Print Options">
      <ControlRow label="Copies">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="template-segmented-btn"
            aria-label="Decrease copies"
            disabled={printSettings.copies <= 1}
            onClick={() => onChange({ copies: Math.max(1, printSettings.copies - 1) })}
            style={{ minWidth: 44, minHeight: 44, fontWeight: 700 }}
          >
            −
          </button>
          <span
            style={{ minWidth: 32, textAlign: 'center', fontWeight: 600, fontSize: '1rem' }}
            aria-live="polite"
            aria-label={`${printSettings.copies} copies`}
          >
            {printSettings.copies}
          </span>
          <button
            type="button"
            className="template-segmented-btn"
            aria-label="Increase copies"
            disabled={printSettings.copies >= MAX_COPIES}
            onClick={() => onChange({ copies: Math.min(MAX_COPIES, printSettings.copies + 1) })}
            style={{ minWidth: 44, minHeight: 44, fontWeight: 700 }}
          >
            +
          </button>
        </div>
      </ControlRow>

      <ToggleRow
        label="Header on All Pages"
        sublabel="Repeat business header on every page"
        checked={printSettings.headerOnAllPages}
        ariaLabel="Repeat header on all pages"
        onChange={(v) => onChange({ headerOnAllPages: v })}
      />
      <ToggleRow
        label="Page Numbers"
        checked={printSettings.pageNumbers}
        ariaLabel="Show page numbers"
        onChange={(v) => onChange({ pageNumbers: v })}
      />
    </Section>
  </>
)

// ─── Main component ───────────────────────────────────────────────────────────

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
