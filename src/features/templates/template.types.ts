/** Invoice Templates — Type definitions (barrel re-export)
 *
 * All types split into logical groups:
 *   - template-layout.types.ts  — Base template, layout, typography, page/print type aliases
 *   - template-config.types.ts  — Config sub-object interfaces (columns, fields, colors, etc.)
 *   - template-entity.types.ts  — Entity, print settings, invoice settings, form data, API responses
 *
 * PRD: invoice-templates-PLAN.md
 * Depends on: invoice.types.ts (DocumentType)
 */

export type {
  BaseTemplate,
  CustomizationTab,
  HeaderStyle,
  ItemTableStyle,
  LogoPosition,
  PageMargins,
  PageOrientation,
  PageSize,
  RoundOffMethod,
  RoundOffPrecision,
  SignaturePosition,
  SummaryPosition,
  TemplateFontFamily,
  TemplateFontSize,
} from './template-layout.types'

export type {
  ColumnConfig,
  TemplateColorsConfig,
  TemplateColumnsConfig,
  TemplateConfig,
  TemplateFieldsConfig,
  TemplateLayoutConfig,
  TemplateTypographyConfig,
} from './template-config.types'

export type {
  DecimalPrecisionSettings,
  InvoiceSettings,
  InvoiceTemplate,
  PrintSettings,
  RoundOffSettings,
  TemplateDetailResponse,
  TemplateFormData,
  TemplateListResponse,
  TemplateSummary,
} from './template-entity.types'
