// ─── HisaabPro — English Ext 13 (INV-06: Purchase + Alerts + Stock Value) ─────

export const enExt13 = {
  // ── Purchase list page ────────────────────────────────────────────────────
  purchasesTitle:              'Purchases',
  purchasesEmpty:              'No purchase invoices yet',
  purchasesEmptyDesc:          'Record purchases from suppliers to track inventory cost',
  createPurchase:              'New Purchase',
  createPurchaseAriaLabel:     'Create new purchase invoice',
  purchaseFilterAll:           'All',
  purchaseFilterDraft:         'Draft',
  purchaseFilterSaved:         'Saved',
  purchaseListHeading:         'Purchase invoice list',
  purchaseFoundSingular:       'purchase invoice found',
  purchaseFoundPlural:         'purchase invoices found',

  // ── Purchase form ─────────────────────────────────────────────────────────
  newPurchase:                 'New Purchase',
  editPurchase:                'Edit Purchase',
  purchaseFormSections:        'Purchase form sections',
  supplierLabel:               'Supplier',
  purchasePriceColLabel:       'Purchase Price',
  stockWillBeAdded:            'Stock will be added when saved',
  savePurchase:                'Save Purchase',
  savingPurchase:              'Saving...',
  savePurchaseDraft:           'Save Draft',
  purchaseSaved:               'Purchase saved. Stock updated.',
  purchaseDraftSaved:          'Draft saved.',
  purchaseUpdated:             'Purchase updated. Stock adjusted.',
  failedSavePurchase:          'Failed to save purchase. Please try again.',
  purchaseDetailTitle:         'Purchase Details',
  purchaseVoided:              'Purchase voided.',
  voidPurchase:                'Void Purchase',
  voidPurchaseDesc:            'This will reverse the stock entry. Continue?',
  confirmVoid:                 'Yes, Void',
  purchaseSupplierHint:        'Select a supplier or create new',

  // ── Stock alerts page ─────────────────────────────────────────────────────
  stockAlertsTitle:            'Low Stock Alerts',
  stockAlertsEmpty:            'All items are well-stocked',
  stockAlertsEmptyDesc:        'When products fall below their minimum level, alerts will appear here.',
  dismissAlert:                'Dismiss',
  dismissingAlert:             'Dismissing...',
  alertDismissed:              'Alert dismissed.',
  alertDismissFailed:          'Failed to dismiss alert.',
  alertProduct:                'Product',
  alertCurrentStock:           'Current Stock',
  alertMinLevel:               'Min. Level',
  alertShortfall:              'Shortfall',
  alertReorderQty:             'Reorder Qty',
  alertType:                   'Alert',
  alertTypeLowStock:           'Low',
  alertTypeOutOfStock:         'Out',
  lowStockPill:                'Low',
  outOfStockPill:              'Out',
  couldNotLoadAlerts:          'Could not load alerts',
  stockAlertsHeading:          'Stock alert list',

  // ── Stock value report ────────────────────────────────────────────────────
  stockValueReportTitle:       'Stock Value Report',
  stockValueReportEmpty:       'No products with stock to value',
  stockValueReportEmptyDesc:   'Add products and record purchases to see the stock value.',
  couldNotLoadStockValue:      'Could not load stock value report',
  totalStockValueLabel:        'Total Stock Value',
  productCountLabel:           'Products',
  avgCostLabel:                'Avg. Cost',
  stockValueLabel:             'Value',
  loadMoreProducts:            'Load More',

  // ── Stock adjust modal (already exists — supplementary keys) ──────────────
  adjustStockForProduct:       'Adjust Stock',
  stockMovementsHeading:       'Stock Movements',
  movementDate:                'Date',
  movementType:                'Type',
  movementQty:                 'Qty',
  movementBalance:             'Balance',
  movementReason:              'Reason',
  movementRef:                 'Reference',

  // ── Sale 409 INSUFFICIENT_STOCK banner ────────────────────────────────────
  errStockShortageTitle:       'Insufficient Stock',
  errStockShortageDetail:      '{product}: only {available} {unit} available, {requested} requested',
  errStockShortageHint:        'Reduce quantities or adjust stock before saving.',
  errStockShortageSingular:    '1 item has insufficient stock',
  errStockShortagePlural:      '{count} items have insufficient stock',

  // ── Nav / more menu ───────────────────────────────────────────────────────
  navStockAlerts:              'Stock Alerts',
  navPurchases:                'Purchases',

  // ── Dashboard tile ────────────────────────────────────────────────────────
  dashboardLowStockAlert:      'products low on stock',
  dashboardLowStockSingular:   'product low on stock',

  // ── Stock verification start page (INV-07) ────────────────────────────────
  startCountTitle:             'Start Stock Count',
  countNameLabel:              'Count Name',
  countNamePlaceholder:        'e.g. Monthly count — May 2026',
  startCountBtn:               'Start Count',
  startingCount:               'Starting...',
  countStarted:                'Stock count started.',
  countStartFailed:            'Could not start count. Try again.',
  filterByCategoryLabel:       'Filter by Category (optional)',
  filterByCategoryHint:        'Leave blank to count all products',

  // ── Stock verification mobile count page (INV-07) ─────────────────────────
  stockCountHeading:           'Stock Count',
  itemsCountedLabel:           '{counted} of {total} counted',
  searchProductsPlaceholder:   'Search by name or SKU...',
  systemQtyLabel:              'System',
  countedQtyLabel:             'Counted',
  deltaLabel:                  'Diff',
  finalizeCountBtn:            'Finalise Count',
  finalizingCount:             'Finalising...',
  countFinalized:              'Count finalised. Adjustments applied.',
  countFinalizeFailed:         'Could not finalise count. Try again.',
  countFinalizeTitle:          'Apply Stock Adjustments?',
  countFinalizeDesc:           '{adjusted} products will be adjusted. Net change: {net} units.',
  countFinalizeNoChange:       'All counts match system stock. No adjustments needed.',
  confirmFinalize:             'Apply Adjustments',
  deletedProductLabel:         '(deleted)',
  noProductsFound:             'No products found for that search.',

  // ── Stock value report (INV-07, csv export) ───────────────────────────────
  exportCsvLabel:              'Export CSV',
  csvExportToast:              'CSV downloaded.',
  skuLabel:                    'SKU',

  // ── Nav / more menu additions (INV-07) ────────────────────────────────────
  navStockCount:               'Stock Count',
  navStockValueReport:         'Stock Value',
  navStockCountDesc:           'Count & verify physical stock',
  navStockValueDesc:           'Total stock value at cost',
}
