/** Template Gallery — Config overrides for all base templates
 *
 * Each template defines a Partial<TemplateConfig> that is merged on top of
 * DEFAULT_TEMPLATE_CONFIG via mergeTemplateConfig() in template.utils.ts.
 *
 * Only the DIFFERENCES from default are specified — everything else inherits.
 *
 * Split into collection files to keep each under 250 lines:
 *   - template-gallery-modern.configs.ts    (Modern + Indian Business)
 *   - template-gallery-industry.configs.ts  (Industry + Compact & Special)
 */

import type { BaseTemplate, DeepPartial, TemplateConfig } from './template.types'
import { MODERN_AND_INDIAN_CONFIGS } from './template-gallery-modern.configs'
import { INDUSTRY_AND_SPECIAL_CONFIGS } from './template-gallery-industry.configs'

/** Partial config overrides per base template (beyond the original 6) */
export const TEMPLATE_CONFIG_OVERRIDES: Partial<Record<BaseTemplate, DeepPartial<TemplateConfig>>> = {
  ...MODERN_AND_INDIAN_CONFIGS,
  ...INDUSTRY_AND_SPECIAL_CONFIGS,
}
