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

  // ── Form — PR5 ────────────────────────────────────────────────────────────
  recurringFormCreateTitle:         'New Schedule',
  recurringFormEditTitle:           'Edit Schedule',
  recurringFieldName:               'Schedule Name',
  recurringFieldNamePlaceholder:    'e.g. Monthly Rent Invoice',
  recurringFieldParty:              'Party',
  recurringFieldFrequency:          'Frequency',
  recurringFieldInterval:           'Repeat Every',
  recurringFieldAnchorDay:          'Day of Month',
  recurringFieldAnchorDayWeekly:    'Day of Week',
  recurringFieldAnchorDayMax:       'Max: 28th',
  recurringFieldStartDate:          'Start Date',
  recurringFieldEndDate:            'End Date (optional)',
  recurringFieldAutoPaymentLink:    'Auto-generate payment link',
  recurringFieldAutoReminder:       'Auto-send reminder',
  recurringFormSave:                'Save Schedule',
  recurringFormCancel:              'Cancel',
  recurringFormItemsTitle:          'Invoice Items',
  recurringFormItemAdd:             'Add Item',
  recurringFormItemRemove:          'Remove',
  recurringFormValidationRequired:  'This field is required.',
  recurringFormValidationEndDate:   'End date must be after start date.',
  recurringFromInvoiceCta:          'Set as Recurring',
  recurringTemplatePickerTitle:     'Select Template Invoice',
  recurringTemplatePickerEmpty:     'No saved invoices yet. Create a SAVED invoice first.',
  recurringTemplatePickerSearch:    'Search invoices...',
  recurringTemplatePickerSelected:  'Template selected',
  recurringFormSaving:              'Saving...',
  recurringFormOfflineToast:        'Saved offline — will create when reconnected.',
  recurringFormSuccessCreate:       'Schedule created. First invoice on ',
  recurringFormSuccessEdit:         'Schedule updated.',
  recurringAutoGenBadge:            'Auto-generated',
  recurringFilterAutoGen:           'Auto-Generated',
} as const
