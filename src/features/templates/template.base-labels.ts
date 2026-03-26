/** Invoice Templates — Base template label & description maps
 *
 * 28 base templates with names, descriptions, and default page sizes.
 * Separated from layout/typography labels for file size management.
 *
 * PRD: invoice-templates-PLAN.md
 */

import type { BaseTemplate, PageSize } from './template.types'

// --- Base template labels ----------------------------------------------------

export const BASE_TEMPLATE_LABELS: Record<BaseTemplate, string> = {
  THERMAL_58MM:      '58mm Thermal',
  THERMAL_80MM:      '80mm Thermal',
  A4_CLASSIC:        'A4 Classic',
  A4_MODERN:         'A4 Modern',
  A5_COMPACT:        'A5 Compact',
  A4_DETAILED:       'A4 Detailed',
  // Modern collection
  A4_ELEGANT:        'Elegant',
  A4_MINIMAL:        'Minimal',
  A4_BOLD:           'Bold',
  A4_CORPORATE:      'Corporate',
  A4_PROFESSIONAL:   'Professional',
  A4_CREATIVE:       'Creative',
  // Indian business
  A4_GST_STANDARD:   'GST Standard',
  A4_GST_DETAILED:   'GST Detailed',
  A4_RETAIL:         'Retail',
  A4_WHOLESALE:      'Wholesale',
  A4_KIRANA:         'Kirana Store',
  A4_MANUFACTURING:  'Manufacturing',
  // Industry
  A4_SERVICES:       'Services',
  A4_FREELANCER:     'Freelancer',
  A4_MEDICAL:        'Medical / Pharma',
  A4_RESTAURANT:     'Restaurant',
  A4_TRANSPORT:      'Transport',
  A4_CONSTRUCTION:   'Construction',
  // Compact & special
  A5_RECEIPT:        'A5 Receipt',
  A5_PROFESSIONAL:   'A5 Professional',
  A4_LETTERHEAD:     'Letterhead',
  A4_TWO_COLUMN:     'Two Column',
  A4_COLORFUL:       'Colorful',
  A4_DARK:           'Dark',
}

export const BASE_TEMPLATE_DESCRIPTIONS: Record<BaseTemplate, string> = {
  THERMAL_58MM:      'For 58mm roll receipt printers — minimal, space-efficient layout',
  THERMAL_80MM:      'For 80mm roll receipt printers — slightly wider with more columns',
  A4_CLASSIC:        'Traditional single-column layout, works on any A4 printer',
  A4_MODERN:         'Clean two-column header with accent color and modern spacing',
  A5_COMPACT:        'Half-page A5 — ideal for short invoices and delivery notes',
  A4_DETAILED:       'Full-detail A4 with HSN, tax breakdown, bank details, and signature',
  // Modern collection
  A4_ELEGANT:        'Sophisticated serif headers with gold accent — premium feel',
  A4_MINIMAL:        'Maximum white space, minimal borders — clean and distraction-free',
  A4_BOLD:           'Large headers, strong colors, high-impact design',
  A4_CORPORATE:      'Formal business layout with company branding prominently placed',
  A4_PROFESSIONAL:   'Balanced layout with subtle accent — suits any business',
  A4_CREATIVE:       'Asymmetric layout with vibrant colors — for design-forward businesses',
  // Indian business
  A4_GST_STANDARD:   'GST-compliant with GSTIN, HSN, CGST/SGST columns visible',
  A4_GST_DETAILED:   'Full GST with HSN, cess, place of supply, e-invoice fields',
  A4_RETAIL:         'Quick retail billing — no tax columns, prominent totals',
  A4_WHOLESALE:      'Quantity-focused with discount columns for bulk orders',
  A4_KIRANA:         'Simple layout for grocery & general stores — Hindi-friendly',
  A4_MANUFACTURING:  'Detailed with HSN, transport, vehicle number, delivery challan fields',
  // Industry
  A4_SERVICES:       'Service invoices with hourly/project rates, no quantity columns',
  A4_FREELANCER:     'Personal branding focus, bank details, clean single-column',
  A4_MEDICAL:        'Pharmacy/clinic billing with batch, expiry columns',
  A4_RESTAURANT:     'Food bill format — table number, no HSN, rounded totals',
  A4_TRANSPORT:      'LR/CN format with vehicle, route, consignor/consignee details',
  A4_CONSTRUCTION:   'Work order format with measurements, contractor details',
  // Compact & special
  A5_RECEIPT:        'Compact receipt for counter billing — A5 half-page',
  A5_PROFESSIONAL:   'Professional A5 with logo, accent bar, all contact info',
  A4_LETTERHEAD:     'Full letterhead with company branding, address bar at top',
  A4_TWO_COLUMN:     'Split layout — business details left, invoice info right',
  A4_COLORFUL:       'Vibrant multi-color sections — stands out in any inbox',
  A4_DARK:           'Dark header with white body — modern and striking',
}

/** Default page size for each base template */
export const BASE_TEMPLATE_PAGE_SIZE: Record<BaseTemplate, PageSize> = {
  THERMAL_58MM:      'THERMAL_58MM',
  THERMAL_80MM:      'THERMAL_80MM',
  A4_CLASSIC:        'A4',
  A4_MODERN:         'A4',
  A5_COMPACT:        'A5',
  A4_DETAILED:       'A4',
  A4_ELEGANT:        'A4',
  A4_MINIMAL:        'A4',
  A4_BOLD:           'A4',
  A4_CORPORATE:      'A4',
  A4_PROFESSIONAL:   'A4',
  A4_CREATIVE:       'A4',
  A4_GST_STANDARD:   'A4',
  A4_GST_DETAILED:   'A4',
  A4_RETAIL:         'A4',
  A4_WHOLESALE:      'A4',
  A4_KIRANA:         'A4',
  A4_MANUFACTURING:  'A4',
  A4_SERVICES:       'A4',
  A4_FREELANCER:     'A4',
  A4_MEDICAL:        'A4',
  A4_RESTAURANT:     'A4',
  A4_TRANSPORT:      'A4',
  A4_CONSTRUCTION:   'A4',
  A5_RECEIPT:        'A5',
  A5_PROFESSIONAL:   'A5',
  A4_LETTERHEAD:     'A4',
  A4_TWO_COLUMN:     'A4',
  A4_COLORFUL:       'A4',
  A4_DARK:           'A4',
}
