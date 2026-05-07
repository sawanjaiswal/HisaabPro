// ─── HisaabPro — English Ext 20 (Cash Register — PR 4) ──────────────────────

export const enExt20 = {
  // ─── Page / tabs ─────────────────────────────────────────────────────────
  cashRegTitle:                 'Cash Register',
  cashRegNavLabel:              'Cash',
  cashRegTabCalculator:         'Calculator',
  cashRegTabHistory:            'History',

  // ─── Calculator panel ────────────────────────────────────────────────────
  cashRegPlaceholderEnterAmount: 'Enter amount',
  cashRegButtonCashIn:          'Cash In',
  cashRegButtonCashOut:         'Cash Out',
  cashRegLabelNote:             'Add note (optional)',
  cashRegPlaceholderNote:       'e.g. delivery, rent, misc',

  // ─── Toasts ──────────────────────────────────────────────────────────────
  cashRegToastCashInSaved:      'Cash In saved',
  cashRegToastCashOutSaved:     'Cash Out saved',
  cashRegToastErrorSave:        'Could not save. Try again.',
  cashRegToastEntryUpdated:     'Entry updated',
  cashRegToastEntryVoided:      'Entry voided',
  cashRegToastEntryRestored:    'Entry restored',
  cashRegToastEntryDeleted:     'Entry deleted',

  // ─── Edit drawer ─────────────────────────────────────────────────────────
  cashRegDrawerTitle:           'Edit Entry',
  cashRegDrawerSaveButton:      'Save Changes',

  // ─── Void dialog ─────────────────────────────────────────────────────────
  cashRegVoidDialogTitle:       'Void this entry?',
  cashRegVoidDialogDescription: 'This entry will be marked as voided. You can restore it later.',
  cashRegLabelVoidReason:       'Reason (optional)',
  cashRegVoidDialogButton:      'Void Entry',

  // ─── Delete dialog ───────────────────────────────────────────────────────
  cashRegDeleteDialogTitle:     'Delete permanently?',
  cashRegDeleteDialogDescription: 'This cannot be undone. Only voided entries can be deleted.',
  cashRegDeleteDialogButton:    'Delete',

  // ─── Large amount dialog ─────────────────────────────────────────────────
  cashRegLargeAmountDescription: 'This is higher than usual. Confirm to proceed.',

  // ─── History empty states ────────────────────────────────────────────────
  cashRegEmptyAllEntries:       'No cash entries yet',
  cashRegEmptyOnlyIn:           'No Cash In entries',
  cashRegEmptyOnlyOut:          'No Cash Out entries',

  // ─── Summary header ──────────────────────────────────────────────────────
  cashRegSummaryToday:          'Today',
  cashRegSummaryLast7Days:      'Last 7 Days',
  cashRegSummaryLast30Days:     'Last 30 Days',
  cashRegSummaryIn:             'In',
  cashRegSummaryOut:            'Out',
  cashRegSummaryNet:            'Net',

  // ─── Expression errors ───────────────────────────────────────────────────
  cashRegErrorInvalidExpression: 'Invalid expression',
  cashRegErrorDivideByZero:     'Cannot divide by zero',
  cashRegErrorAmountHigh:       'Large amount — please confirm',
  cashRegErrorNoInternet:       'No internet connection. Please retry.',
  cashRegErrorRestoreBeforeEdit: 'Restore the entry before editing',
  cashRegErrorAlreadyVoided:    'Entry is already voided',
  cashRegErrorNotVoided:        'Entry is not currently voided',

  // ─── Filters / sort ──────────────────────────────────────────────────────
  cashRegFilterAll:             'All',
  cashRegSortLabel:             'Sort',
  cashRegSortNewest:            'Newest',
  cashRegSortOldest:            'Oldest',
  cashRegSortHighest:           'Highest',
  cashRegSortLowest:            'Lowest',

  // ─── Badges ──────────────────────────────────────────────────────────────
  cashRegBadgeVoided:           'Voided',
  cashRegBadgeEdited:           'Edited',

  // ─── History controls ────────────────────────────────────────────────────
  cashRegShowVoided:            'Show Voided',
  cashRegHideVoided:            'Hide Voided',

  // ─── History error ───────────────────────────────────────────────────────
  cashRegHistoryError:          'Could not load history.',
  cashRegHistoryRetry:          'Tap to retry',
}
