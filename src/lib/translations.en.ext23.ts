// ─── HisaabPro — English Ext 23 (POS Billing Mode — PR10+PR11) ───────────────

export const enExt23 = {
  // ─── Page titles ──────────────────────────────────────────────────────────
  posBillingMode:           'POS Billing',
  posSalesHistory:          'Sales History',
  posSaleDetail:            'Sale Detail',
  posReceiptTitle:          'Receipt',

  // ─── Nav ──────────────────────────────────────────────────────────────────
  posNavLabel:              'POS',

  // ─── Cart ─────────────────────────────────────────────────────────────────
  posCart:                  'Cart',
  posCartItems:             'Cart items',
  posCartEmptyTitle:        'Cart is empty',
  posCartEmptyBody:         'Tap a product to add it to the cart',
  posSubtotal:              'Subtotal',
  posDiscount:              'Discount',
  posTax:                   'Tax',
  posGrandTotal:            'Total',
  posCheckout:              'Checkout',
  posItems:                 'Items',
  posItemCount:             '{n} items',
  posRemoveItem:            'Remove',
  posDecreaseQty:           'Decrease quantity',
  posIncreaseQty:           'Increase quantity',

  // ─── Product grid ─────────────────────────────────────────────────────────
  posSearchProducts:        'Search products…',
  posSearchParty:           'Search by name or phone…',
  posNoProducts:            'No products available',
  posNoProductsSearch:      'No products match "{q}"',
  posProductsError:         'Could not load products',
  posOutOfStock:            'Out of stock',
  posStock:                 'Stock: {n}',

  // ─── Payment modes ────────────────────────────────────────────────────────
  posModeCash:              'Cash',
  posModeUpi:               'UPI',
  posModeCard:              'Card',
  posModeBank:              'Bank Transfer',
  posModeCredit:            'Credit',
  posSelectMode:            'Select payment mode',
  posPaymentTitle:          'Payment',
  posSplitPayment:          'Split payment',
  posChange:                'Change',
  posConfirmSale:           'Confirm sale',
  posProcessing:            'Processing…',
  posAmountShort:           'Payment amount is less than total',

  // ─── UPI QR ───────────────────────────────────────────────────────────────
  posUpiQrTitle:            'Pay via UPI',
  posUpiQrHint:             'Scan with any UPI app',
  posUpiId:                 'UPI ID',
  posOpenUpiApp:            'Open UPI app',
  posPaymentReceived:       'Payment received',

  // ─── Customer ─────────────────────────────────────────────────────────────
  posCustomerSearch:        'Search customer',
  posWalkIn:                'Walk-in',
  posWalkInOptional:        'Walk-in details (optional)',
  posWalkInName:            'Customer name',
  posWalkInPhone:           'Phone number',
  posCustomerSelected:      'Customer selected',
  posRemoveCustomer:        'Remove customer',
  posCustomer:              'Customer',

  // ─── Void / Restore ───────────────────────────────────────────────────────
  posVoidSale:              'Void sale',
  posVoidTitle:             'Void sale',
  posVoidConfirmText:       'Void sale {receipt}? This will reverse all stock movements.',
  posVoidReason:            'Reason',
  posVoidReasonPlaceholder: 'Enter reason (min 3 characters)',
  posVoidConfirm:           'Void sale',
  posVoiding:               'Voiding…',
  posVoided:                'Voided',
  posVoidSuccess:           'Sale voided',
  posVoidFailed:            'Could not void sale',
  posRestoreSale:           'Restore sale',
  posRestoring:             'Restoring…',
  posRestoreSuccess:        'Sale restored',
  posRestoreFailed:         'Could not restore sale',

  // ─── History ──────────────────────────────────────────────────────────────
  posHistoryError:          'Could not load sales',
  posNoSales:               'No sales yet',
  posSalesCount:            '{n} sales',
  posFilterSales:           'Filter sales',
  posStatusFilter:          'Status',
  posStatusActive:          'Active',
  posPaymentModeFilter:     'Payment mode',
  allStatuses:              'All statuses',
  allModes:                 'All modes',

  // ─── Sale detail ──────────────────────────────────────────────────────────
  posDate:                  'Date',
  posTime:                  'Time',
  posPayments:              'Payments',
  posSaleNotFound:          'Sale not found',
  posViewReceipt:           'View receipt',
  posHideReceipt:           'Hide receipt',

  // ─── Receipt ──────────────────────────────────────────────────────────────
  posReceiptSize:           'Receipt size',
  posNewSale:               'New sale',

  // ─── Share ────────────────────────────────────────────────────────────────
  posShareReceipt:          'Share receipt',
  posShareWhatsApp:         'WhatsApp',
  posShareEmail:            'Email',
  posDownloadPdf:           'Download',
  posPrint:                 'Print',
  posShareFailed:           'Share failed',

  // ─── Errors ───────────────────────────────────────────────────────────────
  posSaleFailed:            'Checkout failed. Please try again.',
  posOfflineCheckout:       'Internet required to complete sale',
} as const
