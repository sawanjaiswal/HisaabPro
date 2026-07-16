/** Dashboard Home 2 — PREVIEW mock data.
 *
 * Temporary front-end-only data so the redesigned hero/tiles/carousel render
 * before the backend series endpoint exists. All amounts in PAISE.
 * Numbers mirror Home 2.png. Delete once the real /dashboard series lands.
 */

import type { TranslationKey } from '@/lib/translations'

export interface MetricTileMock {
  id: string
  labelKey: TranslationKey
  /** Lucide icon name */
  icon: string
  /** Amount in paise */
  amount: number
  /** Percent change vs prior period; null → show a status pill instead */
  deltaPct: number | null
  /** Status pill text key (used when deltaPct is null, e.g. Cash in Hand) */
  statusKey?: TranslationKey
  tone: 'teal' | 'coral' | 'success'
}

export interface OverviewCardMock {
  id: string
  labelKey: TranslationKey
  /** Amount in paise */
  amount: number
  deltaPct: number
  /** Sparkline series (arbitrary scale) */
  series: number[]
  positive: boolean
}

/** 31-day sales trend (paise), gently rising like the mockup. */
export const SALES_SERIES: number[] = [
  8_000, 9_500, 9_000, 11_000, 10_500, 13_000, 12_500, 15_000, 18_000, 17_500,
  20_000, 22_000, 21_500, 24_000, 26_000, 25_500, 27_000, 26_500, 28_000, 30_000,
  29_500, 32_000, 34_000, 33_500, 36_000, 38_000, 41_000, 44_000, 47_000, 50_000, 52_300,
].map((r) => r * 100)

export const SALES_TODAY_PAISE = 52_300_00
export const SALES_DELTA_PCT = 18
export const SALES_X_LABELS = ['1 May', '8 May', '15 May', '22 May', '31 May']

export const METRIC_TILES: MetricTileMock[] = [
  { id: 'collections', labelKey: 'collections', icon: 'Wallet', amount: 41_000_00, deltaPct: 12, tone: 'teal' },
  { id: 'expenses', labelKey: 'expenses', icon: 'Receipt', amount: 8_500_00, deltaPct: -6, tone: 'coral' },
  { id: 'cash', labelKey: 'cashInHand', icon: 'Landmark', amount: 52_400_00, deltaPct: null, statusKey: 'statusGood', tone: 'success' },
  { id: 'profit', labelKey: 'profitEst', icon: 'PieChart', amount: 43_800_00, deltaPct: 15, tone: 'teal' },
]

export const OVERVIEW_CARDS: OverviewCardMock[] = [
  { id: 'sales', labelKey: 'totalSales', amount: 1_25_000_00, deltaPct: 18, positive: true,
    series: [20, 24, 22, 30, 28, 26, 34, 40, 38, 44, 52, 48] },
  { id: 'collections', labelKey: 'collections', amount: 85_000_00, deltaPct: 12, positive: true,
    series: [18, 20, 26, 24, 30, 28, 36, 34, 40, 38, 46, 44] },
  { id: 'expenses', labelKey: 'expenses', amount: 18_750_00, deltaPct: -6, positive: false,
    series: [40, 38, 44, 42, 36, 34, 30, 32, 28, 30, 26, 24] },
  { id: 'profit', labelKey: 'profitEst', amount: 43_800_00, deltaPct: 15, positive: true,
    series: [16, 20, 18, 24, 28, 26, 32, 30, 38, 40, 46, 50] },
]
