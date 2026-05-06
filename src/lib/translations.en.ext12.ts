// ─── HisaabPro — English Ext 12 (Recurring Invoices — PR4 detail + runs) ─────

export const enExt12 = {
  // ── List page ────────────────────────────────────────────────────────────
  recurringTitle:             'Recurring Invoices',
  recurringEmpty:             'No recurring schedules',
  recurringEmptyCta:          'Automate your invoicing with recurring schedules',
  recurringFilterAll:         'All',
  recurringFilterActive:      'Active',
  recurringFilterPaused:      'Paused',
  recurringFilterCompleted:   'Completed',

  // ── Status labels ─────────────────────────────────────────────────────────
  recurringStatusActive:      'Active',
  recurringStatusPaused:      'Paused',
  recurringStatusCompleted:   'Completed',

  // ── Run status labels ─────────────────────────────────────────────────────
  recurringRunSuccess:        'Success',
  recurringRunFailed:         'Failed',
  recurringRunSkipped:        'Skipped',
  recurringRunPartial:        'Partial',

  // ── Actions ───────────────────────────────────────────────────────────────
  recurringPause:             'Pause',
  recurringPausing:           'Pausing...',
  recurringPauseConfirm:      'Pause',
  recurringPauseDesc:         'Runs during the pause period will be skipped.',
  recurringResume:            'Resume',
  recurringResuming:          'Resuming...',
  recurringGenerateNow:       'Generate Now',
  recurringGenerating:        'Generating...',
  recurringGenerateConfirm:   'Generate invoice now for',
  recurringNextAutoRun:       'Next auto-run still on',
  recurringDelete:            'Delete',
  recurringDeleting:          'Deleting...',
  recurringDeleteConfirm:     'Delete this schedule? This cannot be undone.',
  recurringEdit:              'Edit',

  // ── Detail page ───────────────────────────────────────────────────────────
  recurringNextRun:           'Next run',
  recurringFrequency:         'Frequency',
  recurringRunHistory:        'Run History',
  recurringNoRuns:            'No runs yet. First invoice will generate on the scheduled date.',

  // ── Offline guard ─────────────────────────────────────────────────────────
  recurringMustBeOnline:      'Must be online to generate now.',

  // ── Toast messages ────────────────────────────────────────────────────────
  recurringPaused:            'Schedule paused.',
  recurringResumed:           'Schedule resumed.',
  recurringGenerated:         'Invoice generated.',
  recurringGeneratedOffline:  'Queued — will generate when online.',
  recurringDeleted:           'Schedule deleted.',
  recurringCreated:           'Schedule created.',
} as const
