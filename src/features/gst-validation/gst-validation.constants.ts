/**
 * Static config for the GST filing-readiness surface (#144).
 * Maps each check id to its translation keys + severity styling.
 */

import type { TranslationKey } from '@/lib/translations'
import type { GstCheckId, GstCheckSeverity } from './gst-validation.types'

export const GST_READINESS_RETURN_TYPES = ['GSTR1', 'GSTR3B'] as const

export const gstValidationKeys = {
  readiness: (period: string, returnType: string) =>
    ['gst-filing-readiness', period, returnType] as const,
}

interface CheckMeta {
  titleKey: TranslationKey
  descKey: TranslationKey
}

/** Title + description copy per check id. */
export const CHECK_META: Record<GstCheckId, CheckMeta> = {
  B2B_MISSING_GSTIN: { titleKey: 'gstChkB2bGstinTitle', descKey: 'gstChkB2bGstinDesc' },
  INVALID_GSTIN_FORMAT: { titleKey: 'gstChkBadGstinTitle', descKey: 'gstChkBadGstinDesc' },
  MISSING_PLACE_OF_SUPPLY: { titleKey: 'gstChkPosTitle', descKey: 'gstChkPosDesc' },
  MISSING_HSN_SAC: { titleKey: 'gstChkHsnTitle', descKey: 'gstChkHsnDesc' },
  INTERSTATE_SPLIT_MISMATCH: { titleKey: 'gstChkSplitTitle', descKey: 'gstChkSplitDesc' },
  COMPOSITION_CHARGING_GST: { titleKey: 'gstChkCompTitle', descKey: 'gstChkCompDesc' },
  ZERO_TAX_ON_TAXABLE: { titleKey: 'gstChkZeroTitle', descKey: 'gstChkZeroDesc' },
}

interface SeverityMeta {
  /** CSS modifier suffix appended to .gstv-check--<modifier>. */
  modifier: string
  labelKey: TranslationKey
}

export const SEVERITY_META: Record<GstCheckSeverity, SeverityMeta> = {
  blocker: { modifier: 'blocker', labelKey: 'gstSevBlocker' },
  warning: { modifier: 'warning', labelKey: 'gstSevWarning' },
}
