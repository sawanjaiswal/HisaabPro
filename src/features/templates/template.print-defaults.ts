/** Template Print Defaults — per-template PrintSettings
 *
 * Extracted from template.defaults.ts to keep files under limit.
 */

import type { BaseTemplate, PrintSettings } from './template.types'

/** Standard A4 print settings — reused by most templates */
const A4_STANDARD: PrintSettings = {
  pageSize:         'A4',
  orientation:      'portrait',
  margins:          'normal',
  copies:           1,
  headerOnAllPages: true,
  pageNumbers:      true,
  itemsPerPage:     20,
  stampStyle:       'badge',
  copyLabels:       false,
  copyLabelMode:    'auto',
  copyLabelNames:   ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
}

/** A5 print settings — reused by compact templates */
const A5_STANDARD: PrintSettings = {
  pageSize:         'A5',
  orientation:      'portrait',
  margins:          'narrow',
  copies:           1,
  headerOnAllPages: false,
  pageNumbers:      false,
  itemsPerPage:     15,
  stampStyle:       'badge',
  copyLabels:       false,
  copyLabelMode:    'auto',
  copyLabelNames:   ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
}

/** Default PrintSettings for each base template. */
export const DEFAULT_PRINT_SETTINGS: Record<BaseTemplate, PrintSettings> = {
  THERMAL_58MM: {
    pageSize:         'THERMAL_58MM',
    orientation:      'portrait',
    margins:          'none',
    copies:           1,
    headerOnAllPages: false,
    pageNumbers:      false,
    itemsPerPage:     0,
    stampStyle:       'none',
    copyLabels:       false,
    copyLabelMode:    'auto',
    copyLabelNames:   ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
  },
  THERMAL_80MM: {
    pageSize:         'THERMAL_80MM',
    orientation:      'portrait',
    margins:          'none',
    copies:           1,
    headerOnAllPages: false,
    pageNumbers:      false,
    itemsPerPage:     0,
    stampStyle:       'none',
    copyLabels:       false,
    copyLabelMode:    'auto',
    copyLabelNames:   ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
  },
  A4_CLASSIC:        { ...A4_STANDARD },
  A4_MODERN:         { ...A4_STANDARD },
  A5_COMPACT:        { ...A5_STANDARD },
  A4_DETAILED:       { ...A4_STANDARD, itemsPerPage: 15 },
  // Modern collection
  A4_ELEGANT:        { ...A4_STANDARD },
  A4_MINIMAL:        { ...A4_STANDARD },
  A4_BOLD:           { ...A4_STANDARD },
  A4_CORPORATE:      { ...A4_STANDARD },
  A4_PROFESSIONAL:   { ...A4_STANDARD },
  A4_CREATIVE:       { ...A4_STANDARD },
  // Indian business
  A4_GST_STANDARD:   { ...A4_STANDARD },
  A4_GST_DETAILED:   { ...A4_STANDARD, itemsPerPage: 15 },
  A4_RETAIL:         { ...A4_STANDARD },
  A4_WHOLESALE:      { ...A4_STANDARD },
  A4_KIRANA:         { ...A4_STANDARD },
  A4_MANUFACTURING:  { ...A4_STANDARD, itemsPerPage: 15 },
  // Industry
  A4_SERVICES:       { ...A4_STANDARD },
  A4_FREELANCER:     { ...A4_STANDARD },
  A4_MEDICAL:        { ...A4_STANDARD, itemsPerPage: 15 },
  A4_RESTAURANT:     { ...A4_STANDARD },
  A4_TRANSPORT:      { ...A4_STANDARD },
  A4_CONSTRUCTION:   { ...A4_STANDARD },
  // Compact & special
  A5_RECEIPT:        { ...A5_STANDARD },
  A5_PROFESSIONAL:   { ...A5_STANDARD, pageNumbers: true },
  A4_LETTERHEAD:     { ...A4_STANDARD },
  A4_TWO_COLUMN:     { ...A4_STANDARD },
  A4_COLORFUL:       { ...A4_STANDARD },
  A4_DARK:           { ...A4_STANDARD },
}
