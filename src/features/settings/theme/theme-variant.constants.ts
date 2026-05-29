import type { ThemeVariant } from '@/context/ThemeContext'
import type { TranslationKey } from '@/lib/translations'

/** Swatch + i18n metadata for the variant picker. Hexes mirror the light-mode
 *  anchors in tokens-variants.css (Classic = the base tokens-colors.css values). */
export interface ThemeVariantOption {
  id: ThemeVariant
  labelKey: TranslationKey
  descKey: TranslationKey
  /** [primary-500, accent-300, surface] — preview swatch chips */
  swatch: [string, string, string]
}

export const THEME_VARIANT_OPTIONS: ThemeVariantOption[] = [
  {
    id: 'classic',
    labelKey: 'themeVariantClassic',
    descKey: 'themeVariantClassicDesc',
    swatch: ['#0B4F5E', '#E0EA49', '#F8F7F4'],
  },
  {
    id: 'modern',
    labelKey: 'themeVariantModern',
    descKey: 'themeVariantModernDesc',
    swatch: ['#1E6FB8', '#38E0C4', '#F8F7F4'],
  },
  {
    id: 'minimal',
    labelKey: 'themeVariantMinimal',
    descKey: 'themeVariantMinimalDesc',
    swatch: ['#3A5A63', '#B8C275', '#F8F7F4'],
  },
]
