// ─── HisaabPro — English Ext 15 (BAT-05 batch picker + expiry UI) ─────────────

export const enExt15 = {
  // ── Batch picker ──────────────────────────────────────────────────────────
  pickBatch:               'Pick Batch',
  pickAnotherBatch:        'Pick Another Batch',
  noBatchSelected:         'No batch selected',
  selectBatch:             'Select Batch',
  batchAutoFefo:           'Auto-selected (earliest expiry first)',
  batchNoExpiry:           '(No expiry — manual pick)',

  // ── Expiry status badges ──────────────────────────────────────────────────
  expired:                 'Expired',
  expiringSoon:            'Expiring Soon',
  expiryNear:              'Expiry Near',
  expiryPassed:            'Expired',

  // ── Inline 409 banner messages ────────────────────────────────────────────
  expiredBatchBlocked:     'Expired batch — cannot sell',
  expiredBatchHint:        'This batch has passed its expiry date. Select a valid batch to continue.',
  allBatchesExpired:       'All batches expired',
  allBatchesExpiredHint:   'No valid batches are available for this product. Please restock before selling.',
  insufficientBatchStock:  'Insufficient batch stock',
  insufficientBatchHint:   'The selected batch does not have enough stock. Pick another batch to continue.',

  // ── Expiry alerts page ────────────────────────────────────────────────────
  expiryAlertsTitle:       'Expiry Alerts',
  expiryAlertsEmpty:       'No expiry alerts',
  expiryAlertsEmptyDesc:   'Batches expiring soon will appear here automatically',
  expiryNearAlert:         'Expiring soon',
  expiryPassedAlert:       'Expired',
  expiryDaysLeft:          '{n} days left',
  expiryDaysAgo:           'Expired {n} days ago',
  expiryToday:             'Expires today',
  expiryBatchLabel:        'Batch:',
  expiryDateLabel:         'Expiry date:',
  expiryStockLabel:        'Stock:',
  couldNotLoadExpiryAlerts: 'Could not load expiry alerts',

  // ── WARN_ONLY toast ───────────────────────────────────────────────────────
  warnOnlyBatchToast:      'Sale recorded with expired batch — review at /alerts',
}
