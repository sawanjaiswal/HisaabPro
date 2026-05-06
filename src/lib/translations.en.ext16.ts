// ─── HisaabPro — English Ext 16 (BAT-07 inventory settings + i18n polish) ────

export const enExt16 = {
  // ── Inventory settings page ───────────────────────────────────────────────
  inventorySettings:           'Inventory Settings',
  inventorySettingsDesc:       'Expiry alerts and batch sale policy',
  expiryAlertDaysLabel:        'Expiry Alert Days',
  expiryAlertDaysDesc:         'Alert this many days before a batch expires (1–365)',
  expiryAlertDaysPlaceholder:  '30',
  expiredBatchPolicyLabel:     'Expired Batch Policy',
  expiredBatchPolicyDesc:      'What happens when a customer tries to sell an expired batch',
  policyWarnOnly:              'Warn only',
  policyWarnOnlyDesc:          'Sale goes through with a warning. Review expired batches in Alerts.',
  policyHardBlock:             'Block sale',
  policyHardBlockDesc:         'Sale is rejected. Staff must pick a valid batch or restock first.',
  saveInventorySettings:       'Save Settings',
  inventorySettingsSaved:      'Inventory settings saved',
  inventorySettingsSavedOffline: 'Saved — will sync when online',
  couldNotLoadInventorySettings: 'Could not load inventory settings',

  // ── BatchPicker i18n polish ───────────────────────────────────────────────
  batchPickerRetry:            'Retry',
  batchPickerNoneAvailable:    'No batches available for this product.',
  batchPickerAvail:            'Avail',
  batchPickerClose:            'Close batch picker',
  batchPickerExpiredInfo:      'Expired batches are blocked by your policy.',

  // ── StockValueReport column headers ──────────────────────────────────────
  svrColumnBatch:              'Batch',
  svrColumnExpiry:             'Expiry',

  // ── StockAlertsPage expiry section skeleton ───────────────────────────────
  expiryAlertsSectionLoading:  'Loading expiry alerts…',
}
