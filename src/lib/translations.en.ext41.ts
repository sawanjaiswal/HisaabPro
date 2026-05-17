// ─── HisaabPro — English Ext 41 (Epic D #125 — Loyalty) ────────────────────
// PR4 — Loyalty frontend (program settings + balance chip + redemption sheet + ledger).
// All keys consumed via useLanguage(); no hardcoded EN/HI in JSX (Rule A).

export const enExt41 = {
  // ── Settings hub row ─────────────────────────────────────────────────────
  loyaltySettingsTitle: 'Loyalty Program',
  loyaltySettingsDesc: 'Reward repeat customers with redeemable points',

  // ── Program page ─────────────────────────────────────────────────────────
  loyaltyProgramHeader: 'Loyalty Program',
  loyaltyProgramDescription:
    'Customers earn points on every sale and redeem them on future purchases.',
  loyaltyEnableLabel: 'Enable Loyalty',
  loyaltyEnableHint: 'When off, no new points are earned or redeemed.',
  loyaltyAccrualSection: 'Earning Rules',
  loyaltyRedemptionSection: 'Redemption Rules',
  loyaltyExpirySection: 'Expiry',

  loyaltyAccrualRateLabel: 'Earn rate (%)',
  loyaltyAccrualRateHint:
    'Example: 1% → ₹100 spent earns 1 point. Max 100%.',
  loyaltyMinSpendLabel: 'Minimum bill (Rs)',
  loyaltyMinSpendHint: 'Sales below this amount earn no points.',
  loyaltyRedemptionUnitLabel: 'Redeem in multiples of',
  loyaltyRedemptionUnitHint: 'Points must be spent in whole units of this size.',
  loyaltyRedemptionRateLabel: 'Value per unit (Rs)',
  loyaltyRedemptionRateHint:
    'Each redemption unit converts to this many rupees off the bill.',
  loyaltyExpiryToggleLabel: 'Points expire',
  loyaltyExpiryMonthsLabel: 'Expire after (months)',
  loyaltyExpiryNeverHint:
    'When off, earned points stay forever. Indian retail default is 12-24 months.',

  loyaltySaveButton: 'Save Program',
  loyaltySaveProgress: 'Saving…',
  loyaltySavedToast: 'Loyalty program saved',
  loyaltyQueuedToast: 'Saved — will sync when online',
  loyaltySaveFailed: 'Could not save loyalty program',
  loyaltyLoadFailed: 'Could not load loyalty program',

  // Form validation
  loyaltyErrorRateNegative: 'Earn rate cannot be negative',
  loyaltyErrorRateMax: 'Earn rate cannot exceed 100%',
  loyaltyErrorMinSpendNegative: 'Minimum bill cannot be negative',
  loyaltyErrorRedemptionUnit: 'Redemption unit must be 1 or more',
  loyaltyErrorRedemptionPaise: 'Value per unit cannot be negative',
  loyaltyErrorExpiryRange: 'Expiry must be between 1 and 60 months',

  // ── Balance chip ─────────────────────────────────────────────────────────
  loyaltyChipPoints: 'pts',
  loyaltyChipNoBalance: 'No points yet',
  loyaltyChipExpiringSoon: 'expiring soon',
  loyaltyChipExpiringWindow: 'in {days} days',
  loyaltyChipLoading: 'Loading points…',

  // ── Redemption sheet ────────────────────────────────────────────────────
  loyaltyRedeemTitle: 'Use Loyalty Points',
  loyaltyRedeemBalance: 'Balance',
  loyaltyRedeemBillTotal: 'Bill total',
  loyaltyRedeemPointsLabel: 'Points to redeem',
  loyaltyRedeemMax: 'Max',
  loyaltyRedeemDiscountLabel: 'Discount applied',
  loyaltyRedeemApply: 'Apply',
  loyaltyRedeemRemove: 'Remove redemption',
  loyaltyRedeemCancel: 'Cancel',
  loyaltyRedeemExceedsBalance: 'You don’t have that many points',
  loyaltyRedeemExceedsBill: 'Redemption cannot exceed the bill',
  loyaltyRedeemUnitHint: 'Redeem in multiples of {unit}',
  loyaltyRedeemAppliedRow: 'Loyalty redemption',
  loyaltyRedeemUsePoints: 'Use points',
  loyaltyRedeemNoProgram: 'Loyalty is not active for this business',
  loyaltyRedeemRequiresParty: 'Choose a customer to redeem points',

  // ── Ledger list ─────────────────────────────────────────────────────────
  loyaltyLedgerTitle: 'Points History',
  loyaltyLedgerEmpty: 'No points activity yet',
  loyaltyLedgerEmptyDesc:
    'Points earned and redeemed on this customer’s sales will appear here.',
  loyaltyLedgerError: 'Could not load points history',
  loyaltyLedgerLoadMore: 'Load more',
  loyaltyLedgerExpiresOn: 'Expires {date}',
  loyaltyLedgerNeverExpires: 'No expiry',
  loyaltyLedgerNotePrefix: 'Note',

  loyaltyTypeAc: 'Earned',
  loyaltyTypeRd: 'Redeemed',
  loyaltyTypeEx: 'Expired',
  loyaltyTypeAd: 'Adjusted',
  loyaltyTypeVd: 'Sale voided',
  loyaltyTypeVr: 'Sale restored',

  // ── Party detail tab ────────────────────────────────────────────────────
  loyaltyTabTitle: 'Loyalty',
  loyaltyTabSummaryHeader: 'Points Summary',
  loyaltyTabCurrent: 'Current',
  loyaltyTabLifetimeEarned: 'Lifetime earned',
  loyaltyTabLifetimeRedeemed: 'Lifetime redeemed',
  loyaltyTabExpiringSoon: 'Expiring soon',
  loyaltyTabDisabled: 'Loyalty is not enabled',
  loyaltyTabDisabledDesc:
    'Turn on the loyalty program in Settings to start awarding points.',
  loyaltyTabGoToSettings: 'Open loyalty settings',
} as const
