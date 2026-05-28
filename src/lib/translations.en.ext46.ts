/** Translations — ext46: predictive analytics / insights (#146). */

export const enExt46 = {
  // Page / nav
  insights: 'Insights',
  insightsNavDesc: 'Revenue trends & stock-out forecasts',
  insightsEmptyTitle: 'Not enough data yet',
  insightsEmptyDesc: 'Record a few sales and your forecasts will appear here.',
  couldNotLoadInsights: "Couldn't load insights",

  // Revenue forecast
  revenueForecast: 'Revenue forecast',
  revenueForecastDesc: 'Projected from your recent monthly sales trend',
  nextMonthProjected: 'Next month (projected)',
  revenueChartLabel: 'Monthly revenue trend with projection',
  forecastDisclaimer: 'Projections are estimates based on past sales, not guarantees.',

  // Stock forecast
  stockForecast: 'Stock-out forecast',
  stockForecastDesc: 'Products likely to run out soonest',
  inStock: 'in stock',
  perDay: '/day',
  daysLeft: 'days left',
  reorderSoon: 'Reorder soon',
  noStockOutRisk: 'No stock-out risk',
  noStockForecastData: 'No products are selling fast enough to forecast.',
} as const
