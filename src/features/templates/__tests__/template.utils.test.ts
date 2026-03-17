import { describe, it, expect } from 'vitest'
import {
  buildDefaultConfig,
  buildDefaultPrintSettings,
  countVisibleColumns,
  mergeTemplateConfig,
  validateTemplateName,
  formatBaseTemplateName,
} from '../template.utils'
import { DEFAULT_TEMPLATE_CONFIG } from '../template.constants'

// ─── Config builders ─────────────────────────────────────────────────────────

describe('buildDefaultConfig', () => {
  it('returns standard config for A4', () => {
    const config = buildDefaultConfig('A4_CLASSIC')
    expect(config.layout.headerStyle).toBe(DEFAULT_TEMPLATE_CONFIG.layout.headerStyle)
    expect(config.fields.signature).toBe(DEFAULT_TEMPLATE_CONFIG.fields.signature)
  })

  it('returns thermal overrides for 58mm', () => {
    const config = buildDefaultConfig('THERMAL_58MM')
    expect(config.layout.itemTableStyle).toBe('minimal')
    expect(config.layout.logoPosition).toBe('none')
    expect(config.fields.signature).toBe(false)
    expect(config.fields.bankDetails).toBe(false)
  })

  it('returns thermal overrides for 80mm', () => {
    const config = buildDefaultConfig('THERMAL_80MM')
    expect(config.layout.itemTableStyle).toBe('minimal')
  })
})

describe('buildDefaultPrintSettings', () => {
  it('returns settings for A4', () => {
    const settings = buildDefaultPrintSettings('A4_CLASSIC')
    expect(settings).toBeDefined()
  })

  it('returns settings for thermal', () => {
    const settings = buildDefaultPrintSettings('THERMAL_58MM')
    expect(settings).toBeDefined()
  })
})

// ─── Column helpers ──────────────────────────────────────────────────────────

describe('countVisibleColumns', () => {
  it('counts default visible columns', () => {
    const count = countVisibleColumns(DEFAULT_TEMPLATE_CONFIG.columns)
    expect(count).toBeGreaterThan(3) // at least item, qty, rate, amount
  })
})

// ─── Config merge ────────────────────────────────────────────────────────────

describe('mergeTemplateConfig', () => {
  it('overrides only specified fields', () => {
    const merged = mergeTemplateConfig(
      { colors: { ...DEFAULT_TEMPLATE_CONFIG.colors, accent: '#16A34A' } },
      DEFAULT_TEMPLATE_CONFIG,
    )
    expect(merged.colors.accent).toBe('#16A34A')
    expect(merged.layout).toEqual(DEFAULT_TEMPLATE_CONFIG.layout)
  })

  it('returns base when partial is empty', () => {
    const merged = mergeTemplateConfig({}, DEFAULT_TEMPLATE_CONFIG)
    expect(merged.layout).toEqual(DEFAULT_TEMPLATE_CONFIG.layout)
  })
})

// ─── Validation ──────────────────────────────────────────────────────────────

describe('validateTemplateName', () => {
  it('rejects empty name', () => {
    expect(validateTemplateName('')).toMatch(/required/)
  })

  it('rejects whitespace-only', () => {
    expect(validateTemplateName('   ')).toMatch(/required/)
  })

  it('accepts valid name', () => {
    expect(validateTemplateName('My Template')).toBeNull()
  })
})

// ─── Display helpers ─────────────────────────────────────────────────────────

describe('formatBaseTemplateName', () => {
  it('formats thermal template name', () => {
    expect(formatBaseTemplateName('THERMAL_58MM')).toBe('58mm Thermal')
  })

  it('formats A4 template name', () => {
    expect(formatBaseTemplateName('A4_CLASSIC')).toBe('A4 Classic')
  })
})
