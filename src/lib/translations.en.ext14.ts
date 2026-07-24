// ─── HisaabPro — English Ext 14 (Jobs feature) ────────────────────────────────

export const enExt14 = {
  // ── Jobs list page ────────────────────────────────────────────────────────
  jobsTitle:               'Jobs',
  jobsEmpty:               'No jobs yet',
  jobsEmptyDesc:           'Create your first job to track work orders and service tasks',
  createJob:               'New Job',
  newJob:                  'New Job',
  editJob:                 'Edit Job',

  // ── Job form ──────────────────────────────────────────────────────────────
  jobTitleLabel:           'Job Title',
  jobTitlePlaceholder:     'e.g. AC Repair, Website Design',
  jobTitleRequired:        'Job title is required',
  jobDescLabel:            'Description (optional)',
  jobDescPlaceholder:      'Job details, scope of work...',
  jobScheduledLabel:       'Scheduled Date & Time (optional)',
  jobItemsLabel:           'Items',
  jobItemRequired:         'Customer / supplier is required',
  jobAtLeastOneItem:       'At least one item is required',
  jobItemDescRequired:     'All items need a description',
  jobItemLabel:            'Item',
  jobItemDescPlaceholder:  'Description / service name',
  jobItemQtyLabel:         'Qty',
  jobItemRateLabel:        'Rate (₹)',
  jobItemDiscountLabel:    'Discount (₹)',
  jobAddItem:              'Add Item',
  jobSubtotalLabel:        'Subtotal:',
  jobDiscountLabel:        'Discount:',
  jobTotalLabel:           'Total:',
  saveJob:                 'Save Job',
  savingJob:               'Saving...',
  createJobBtn:            'Create Job',
  jobCreated:              'Job created',
  jobCreateFailed:         'Failed to create job',
  jobSavedOffline:         'Saved — will sync when online',
  jobUpdated:              'Job updated',
  jobUpdateFailed:         'Failed to update job',

  // ── Job detail page ───────────────────────────────────────────────────────
  jobDetailTitle:          'Job Details',
  jobActionsSection:       'Actions',
  jobInvoiceSection:       'Invoice',
  jobItemsSection:         'Items',
  jobCompleteInvoiceHint:  'This job is complete. Create an invoice to bill the customer.',
  viewInvoice:             'View Invoice',
  jobCancelledLabel:       'Cancelled:',

  // ── Status labels ─────────────────────────────────────────────────────────
  jobStatusQuoted:         'Quoted',
  jobStatusScheduled:      'Scheduled',
  jobStatusInProgress:     'In Progress',
  jobStatusCompleted:      'Completed',
  jobStatusInvoiced:       'Invoiced',
  jobStatusCancelled:      'Cancelled',

  // ── Status action buttons ─────────────────────────────────────────────────
  jobActionMarkQuoted:     'Mark Quoted',
  jobActionSchedule:       'Schedule',
  jobActionStartWork:      'Start Work',
  jobActionMarkCompleted:  'Mark Completed',
  jobActionMarkInvoiced:   'Mark Invoiced',
  jobActionCancelJob:      'Cancel Job',
  jobCancelReasonLabel:    'Reason for cancellation',
  jobCancelReasonRequired: 'Enter reason...',
  jobConfirmCancel:        'Confirm Cancel',
  jobCancelBack:           'Back',

  // ── Job list item ─────────────────────────────────────────────────────────
  couldNotLoadJob:         'Could not load job',
  jobLoadRetryHint:        'Check your connection and try again',

  // ── Jobs list / detail i18n sweep ────────────────────────────────────────
  jobCreateAriaLabel:      'Create new job',
  jobCreateFirstAria:      'Create first job',
  jobRowAriaPrefix:        'Job',
  jobStatusLabel:          'Status',
  jobNoItems:              'No items on this job.',
  jobItemsTableAria:       'Job items',
  jobColDescription:       'Description',
  jobColQty:               'Qty',
  jobColRate:              'Rate',
  jobColTotal:             'Total',
  jobLoadingOne:           'Loading job',
  jobsLoading:             'Loading jobs',
  jobsLoadError:           'Could not load jobs',
  jobConvertAria:          'Convert job to invoice',
}
