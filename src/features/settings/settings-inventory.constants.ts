/** Inventory-domain defaults extracted from settings.constants.ts (250-LOC split).
 *
 * Includes DEFAULT_APP_SETTINGS and DEFAULT_TRANSACTION_LOCK_CONFIG — these
 * were the last block added when inventory settings constants pushed the main
 * file past the 250-line cap.
 */

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_APP_SETTINGS = {
  dateFormat:          'DD/MM/YYYY' as const,
  pinEnabled:          false,
  biometricEnabled:    false,
  operationPinSet:     false,
  calculatorPosition:  'BOTTOM_RIGHT' as const,
  language:            'en',
  theme:               'light' as const,
}

export const DEFAULT_TRANSACTION_LOCK_CONFIG = {
  lockAfterDays:                 null,
  requireApprovalForEdit:        false,
  requireApprovalForDelete:      false,
  priceChangeThresholdPercent:   null,
  discountThresholdPercent:      null,
  operationPinSet:               false,
}
