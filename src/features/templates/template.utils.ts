/** Invoice Templates — Pure utility functions
 *
 * No hooks, no side effects. All functions: input → output.
 * Import TemplateConfig/PrintSettings defaults from constants — never hardcode values here.
 */

import type {
  BaseTemplate,
  TemplateConfig,
  PrintSettings,
  TemplateColumnsConfig,
  ColumnConfig,
} from './template.types'
import {
  DEFAULT_TEMPLATE_CONFIG,
  DEFAULT_PRINT_SETTINGS,
  BASE_TEMPLATE_LABELS,
  COLUMN_ORDER,
  TEMPLATE_NAME_MAX,
} from './template.constants'

// ─── Config builders ──────────────────────────────────────────────────────────

/**
 * Build a full TemplateConfig for a given base template.
 * Starts from DEFAULT_TEMPLATE_CONFIG and overrides the page-size-appropriate
 * defaults (e.g. thermal templates hide page numbers and use minimal table style).
 *
 * buildDefaultConfig('THERMAL_58MM')  → config with itemTableStyle:'minimal', no pageNumbers
 * buildDefaultConfig('A4_CLASSIC')    → standard A4 config with bordered table
 */
export function buildDefaultConfig(baseTemplate: BaseTemplate): TemplateConfig {
  const isThermal = baseTemplate === 'THERMAL_58MM' || baseTemplate === 'THERMAL_80MM'

  if (!isThermal) {
    return { ...DEFAULT_TEMPLATE_CONFIG }
  }

  // Thermal overrides: minimal table, no signatures, fewer footer blocks
  return {
    ...DEFAULT_TEMPLATE_CONFIG,
    layout: {
      ...DEFAULT_TEMPLATE_CONFIG.layout,
      logoPosition:      'none',
      headerStyle:       'minimal',
      itemTableStyle:    'minimal',
      summaryPosition:   'full-width',
      signaturePosition: 'left',
    },
    columns: {
      ...DEFAULT_TEMPLATE_CONFIG.columns,
      serialNumber:   { visible: false, label: '#' },
      unit:           { visible: false, label: 'Unit' },
    },
    fields: {
      ...DEFAULT_TEMPLATE_CONFIG.fields,
      businessEmail:    false,
      businessPan:      false,
      shippingAddress:  false,
      bankDetails:      false,
      signature:        false,
      termsAndConditions: false,
      qrCode:           false,
      watermark:        false,
      totalInWords:     false,
    },
  }
}

/**
 * Build default PrintSettings for a given base template.
 * Returns the page-size–appropriate defaults from DEFAULT_PRINT_SETTINGS.
 *
 * buildDefaultPrintSettings('THERMAL_58MM') → { pageSize: 'THERMAL_58MM', margins: 'none', … }
 * buildDefaultPrintSettings('A4_CLASSIC')   → { pageSize: 'A4', margins: 'normal', … }
 */
export function buildDefaultPrintSettings(baseTemplate: BaseTemplate): PrintSettings {
  return { ...DEFAULT_PRINT_SETTINGS[baseTemplate] }
}

// ─── Column helpers ───────────────────────────────────────────────────────────

/**
 * Return all visible columns in their canonical print order with key and label.
 * Locked columns (itemName, quantity, rate, amount) are always included.
 *
 * getVisibleColumns(config.columns) → [{ key: 'serialNumber', label: '#' }, …]
 */
export function getVisibleColumns(
  columns: TemplateColumnsConfig,
): Array<{ key: keyof TemplateColumnsConfig; label: string }> {
  return COLUMN_ORDER.reduce<Array<{ key: keyof TemplateColumnsConfig; label: string }>>(
    (acc, key) => {
      const col: ColumnConfig = columns[key]
      if (col.visible) {
        acc.push({ key, label: col.label })
      }
      return acc
    },
    [],
  )
}

/**
 * Count the number of visible columns.
 * Useful for calculating column widths in the PDF renderer.
 *
 * countVisibleColumns(config.columns) → 6
 */
export function countVisibleColumns(columns: TemplateColumnsConfig): number {
  return COLUMN_ORDER.filter(key => columns[key].visible).length
}

// ─── Config merge ─────────────────────────────────────────────────────────────

/**
 * Deep-merge a partial TemplateConfig on top of a base config.
 * Each top-level section (layout, columns, fields, typography, colors) is spread
 * individually so missing keys always fall back to the base value.
 *
 * mergeTemplateConfig({ colors: { accent: '#16A34A' } }, DEFAULT_TEMPLATE_CONFIG)
 *   → full config with only accent overridden
 */
export function mergeTemplateConfig(
  partial: Partial<TemplateConfig>,
  base: TemplateConfig,
): TemplateConfig {
  return {
    layout:     { ...base.layout,     ...(partial.layout     ?? {}) },
    columns:    mergeColumnsConfig(partial.columns, base.columns),
    fields:     { ...base.fields,     ...(partial.fields     ?? {}) },
    typography: { ...base.typography, ...(partial.typography ?? {}) },
    colors:     { ...base.colors,     ...(partial.colors     ?? {}) },
    headerText: partial.headerText ?? base.headerText,
    footerText: partial.footerText ?? base.footerText,
    termsText:  partial.termsText  ?? base.termsText,
  }
}

/**
 * Merge partial TemplateColumnsConfig. Each column entry is spread individually
 * so a partial `{ visible: true }` without a `label` keeps the base label.
 */
function mergeColumnsConfig(
  partial: Partial<TemplateColumnsConfig> | undefined,
  base: TemplateColumnsConfig,
): TemplateColumnsConfig {
  if (partial === undefined) return { ...base }

  const result = { ...base } as TemplateColumnsConfig
  for (const key of COLUMN_ORDER) {
    const override = partial[key]
    if (override !== undefined) {
      result[key] = { ...base[key], ...override }
    }
  }
  return result
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a template name.
 * Returns an error message string on failure, or null when valid.
 *
 * validateTemplateName('')            → 'Template name is required'
 * validateTemplateName('   ')        → 'Template name is required'
 * validateTemplateName('My Template') → null
 */
export function validateTemplateName(name: string): string | null {
  if (name.trim().length === 0) return 'Template name is required'
  if (name.length > TEMPLATE_NAME_MAX) {
    return `Template name must be ${TEMPLATE_NAME_MAX} characters or fewer`
  }
  return null
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Human-readable label for a base template enum value.
 *
 * formatBaseTemplateName('THERMAL_58MM') → 'Thermal 58mm'
 * formatBaseTemplateName('A4_MODERN')    → 'A4 Modern'
 */
export function formatBaseTemplateName(base: BaseTemplate): string {
  return BASE_TEMPLATE_LABELS[base]
}
