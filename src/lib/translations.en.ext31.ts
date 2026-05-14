// ─── HisaabPro — English Ext 31 (Epic C PR2 — #129 UPI QR on invoice) ─────────

export const enExt31 = {
  // UpiPayCard
  upiPayCardTitle:      'Pay via UPI',
  upiPayCardSubtitle:   'Scan QR or tap to pay',
  upiPayCardCta:        'Open UPI app',
  upiPayCardPaidBadge:  'Invoice fully paid',
  upiPayCardNoUpi:      'Add UPI ID in Settings to show payment QR',
  upiPayCardAddUpi:     'Add UPI ID',
  upiPayCardAmountLine: 'Pay {amount} to {name}',
  // Business settings — UPI ID input
  upiVpaSettingsLabel:  'UPI ID (VPA)',
  upiVpaSettingsHelp:   'Example: yourname@bank',
  upiVpaInvalidFormat:  'UPI ID format: name@bank',
  upiVpaSaved:          'UPI ID saved',
  upiVpaCleared:        'UPI ID removed',
} as const
