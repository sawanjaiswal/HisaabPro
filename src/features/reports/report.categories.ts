/** Reports — Hub category definitions (displayed as cards on /reports) */

import { ROUTES } from '@/config/routes.config'
import type { ReportCategory } from './report.types'

/** Displayed as cards on the /reports hub page.
 *  Order here determines the visual order on screen.
 */
export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id:          'sales',
    title:       'Sales Report',
    description: 'Track all sale invoices',
    icon:        'TrendingUp',
    route:       ROUTES.REPORT_SALES,
    color:       'var(--color-primary-600)',
  },
  {
    id:          'purchases',
    title:       'Purchase Report',
    description: 'Track all purchases',
    icon:        'ShoppingCart',
    route:       ROUTES.REPORT_PURCHASES,
    color:       'var(--color-info-600)',
  },
  {
    id:          'stock',
    title:       'Stock Summary',
    description: 'Current stock levels & values',
    icon:        'Package',
    route:       ROUTES.REPORT_STOCK_SUMMARY,
    color:       'var(--color-warning-600)',
  },
  {
    id:          'daybook',
    title:       'Day Book',
    description: 'All transactions for a day',
    icon:        'Calendar',
    route:       ROUTES.REPORT_DAY_BOOK,
    color:       'var(--color-success-600)',
  },
  {
    id:          'payments',
    title:       'Payment History',
    description: 'All payments in & out',
    icon:        'Banknote',
    route:       ROUTES.REPORT_PAYMENT_HISTORY,
    color:       'var(--color-error-600)',
  },
  {
    id:          'tax_summary',
    title:       'Tax Summary',
    description: 'GST tax collected & payable',
    icon:        'Receipt',
    route:       ROUTES.REPORT_TAX_SUMMARY,
    color:       'var(--color-brand-primary)',
  },
  {
    id:          'gst_returns',
    title:       'GST Returns',
    description: 'GSTR-1, GSTR-3B, GSTR-9',
    icon:        'FileText',
    route:       ROUTES.REPORT_GST_RETURNS,
    color:       'var(--color-brand-secondary)',
  },
  {
    id:          'profit_loss',
    title:       'Profit & Loss',
    description: 'Income vs expenses + net profit',
    icon:        'TrendingUp',
    route:       ROUTES.REPORT_PROFIT_LOSS,
    color:       'var(--color-success-600)',
  },
  {
    id:          'balance_sheet',
    title:       'Balance Sheet',
    description: 'Assets, liabilities & equity',
    icon:        'BarChart3',
    route:       ROUTES.REPORT_BALANCE_SHEET,
    color:       'var(--color-info-600)',
  },
  {
    id:          'cash_flow',
    title:       'Cash Flow',
    description: 'Operating, investing & financing',
    icon:        'Banknote',
    route:       ROUTES.REPORT_CASH_FLOW,
    color:       'var(--color-primary-600)',
  },
  {
    id:          'aging',
    title:       'Aging Report',
    description: 'Receivables & payables by age',
    icon:        'Calendar',
    route:       ROUTES.REPORT_AGING,
    color:       'var(--color-warning-600)',
  },
  {
    id:          'profitability',
    title:       'Profitability',
    description: 'Margin analysis by party/product',
    icon:        'TrendingUp',
    route:       ROUTES.REPORT_PROFITABILITY,
    color:       'var(--color-error-600)',
  },
  {
    id:          'discounts',
    title:       'Discount Report',
    description: 'Discounts given on invoices',
    icon:        'Percent',
    route:       ROUTES.REPORT_DISCOUNTS,
    color:       'var(--color-warning-600)',
  },
  {
    id:          'tally_export',
    title:       'Tally Export',
    description: 'Export data for TallyPrime',
    icon:        'FileCode',
    route:       ROUTES.TALLY_EXPORT,
    color:       'var(--color-gray-600)',
  },
]
