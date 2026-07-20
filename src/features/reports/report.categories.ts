/** Reports — Hub category definitions (displayed as cards on /reports) */

import { ROUTES } from '@/config/routes.config'
import type { ReportCategory } from './report.types'

/** Displayed as cards on the /reports hub page.
 *  Order here determines the visual order on screen.
 */
export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id:          'sales',
    titleKey:    'salesReport',
    descKey:     'salesReportDesc',
    icon:        'TrendingUp',
    route:       ROUTES.REPORT_SALES,
    color:       'var(--color-primary-600)',
  },
  {
    id:          'purchases',
    titleKey:    'purchaseReport',
    descKey:     'purchaseReportDesc',
    icon:        'ShoppingCart',
    route:       ROUTES.REPORT_PURCHASES,
    color:       'var(--color-info-600)',
  },
  {
    id:          'stock',
    titleKey:    'stockSummary',
    descKey:     'stockSummaryDesc',
    icon:        'Package',
    route:       ROUTES.REPORT_STOCK_SUMMARY,
    color:       'var(--color-warning-600)',
  },
  {
    id:          'daybook',
    titleKey:    'dayBook',
    descKey:     'dayBookDesc',
    icon:        'Calendar',
    route:       ROUTES.REPORT_DAY_BOOK,
    color:       'var(--color-success-600)',
  },
  {
    id:          'payments',
    titleKey:    'paymentHistory',
    descKey:     'paymentHistoryDesc',
    icon:        'Banknote',
    route:       ROUTES.REPORT_PAYMENT_HISTORY,
    color:       'var(--color-error-600)',
  },
  {
    id:          'tax_summary',
    titleKey:    'taxSummaryReport',
    descKey:     'taxSummaryDesc',
    icon:        'Receipt',
    route:       ROUTES.REPORT_TAX_SUMMARY,
    color:       'var(--color-brand-primary)',
  },
  {
    id:          'gst_returns',
    titleKey:    'gstReturnsReport',
    descKey:     'gstReturnsDesc',
    icon:        'FileText',
    route:       ROUTES.REPORT_GST_RETURNS,
    color:       'var(--color-brand-secondary)',
  },
  {
    id:          'profit_loss',
    titleKey:    'profitLossReport',
    descKey:     'profitLossDesc',
    icon:        'TrendingUp',
    route:       ROUTES.REPORT_PROFIT_LOSS,
    color:       'var(--color-success-600)',
  },
  {
    id:          'balance_sheet',
    titleKey:    'balanceSheetReport',
    descKey:     'balanceSheetDesc',
    icon:        'BarChart3',
    route:       ROUTES.REPORT_BALANCE_SHEET,
    color:       'var(--color-info-600)',
  },
  {
    id:          'cash_flow',
    titleKey:    'cashFlowReport',
    descKey:     'cashFlowDesc',
    icon:        'Banknote',
    route:       ROUTES.REPORT_CASH_FLOW,
    color:       'var(--color-primary-600)',
  },
  {
    id:          'aging',
    titleKey:    'agingReport',
    descKey:     'agingReportDesc',
    icon:        'Calendar',
    route:       ROUTES.REPORT_AGING,
    color:       'var(--color-warning-600)',
  },
  {
    id:          'profitability',
    titleKey:    'profitabilityReport',
    descKey:     'profitabilityDesc',
    icon:        'TrendingUp',
    route:       ROUTES.REPORT_PROFITABILITY,
    color:       'var(--color-error-600)',
  },
  {
    id:          'discounts',
    titleKey:    'discountReport',
    descKey:     'discountReportDesc',
    icon:        'Percent',
    route:       ROUTES.REPORT_DISCOUNTS,
    color:       'var(--color-warning-600)',
  },
  {
    id:          'tally_export',
    titleKey:    'tallyExportReport',
    descKey:     'tallyExportCardDesc',
    icon:        'FileCode',
    route:       ROUTES.TALLY_EXPORT,
    color:       'var(--color-gray-600)',
  },
]
