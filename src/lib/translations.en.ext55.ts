/** Translations — V2 Appointments (FE-1).
 *
 * Keys cover: nav entry, page chrome, status labels, action labels, drawer
 * fields, error states, replay-rejection toast, FE-2 placeholders. Lands in
 * the en barrel via `translations.ts` import.
 */

export const enExt55 = {
  // Nav + page chrome
  appointments: 'Appointments',
  appointment: 'Appointment',
  newAppointment: 'New appointment',
  appointmentEmptyTitle: 'No appointments yet',
  appointmentEmptyDesc: 'Tap an empty hour to add a slot, or use the button below.',
  appointmentEmptyAction: 'New appointment',
  dayView: 'Day view',
  weekView: 'Week view',
  addAtHour: 'Add at',
  appointmentCreated: 'Appointment created',
  appointmentUpdated: 'Appointment updated',
  appointmentQueued: 'Saved — will sync when online',
  appointmentLoadFailed: 'Could not load appointments',
  appointmentSaveFailed: 'Could not save appointment',
  appointmentNotFoundTitle: 'Appointment not found',
  appointmentNotFoundDesc: 'It may have been deleted or you may not have access.',
  appointmentNoMoreTransitions: 'No further actions available.',
  appointmentDestructiveDesc: 'This action cannot be undone.',

  // Replay rejection toast (FE-1: toast only; FE-2 will also reopen the drawer).
  appointmentReplayRejected: "Couldn't update {party}'s appointment — status no longer valid",
  offlineReplayRejected: "An offline change to {entity} could not be applied — please refresh",

  // Status labels
  apptStatusScheduled: 'Scheduled',
  apptStatusConfirmed: 'Confirmed',
  apptStatusCheckedIn: 'Checked in',
  apptStatusInProgress: 'In progress',
  apptStatusCompleted: 'Completed',
  apptStatusCancelled: 'Cancelled',
  apptStatusNoShow: 'No-show',

  // Action labels
  apptActionSchedule: 'Schedule',
  apptActionConfirm: 'Confirm',
  apptActionStart: 'Start',
  checkIn: 'Check in',
  complete: 'Complete',
  confirmCancel: 'Cancel',
  noShow: 'No-show',
  chooseSlot: 'Choose a slot',
  slotUnavailable: 'Slot unavailable',

  // Drawer fields
  partyId: 'Party ID',
  partyIdPlaceholder: 'Paste party id',
  partyNamePlaceholder: 'Display name',
  employeeId: 'Employee ID (optional)',
  employeeIdPlaceholder: 'Leave blank to auto-assign',
  startTime: 'Start time',
  duration: 'Duration',
  minutesShort: 'min',
  notesPlaceholder: 'Anything important — but no PHI for clinics',
  repeats: 'Repeats',
  none: 'None',
  unsavedAppointmentDesc: 'Your edits to this appointment will be lost.',
  discardChanges: 'Discard changes?',
  discard: 'Discard',
  keepEditing: 'Keep editing',

  // Clinic
  clinicNotesNoPHI:
    'Clinical notes are not encrypted at rest yet — do not store PHI.',

  // Misc
  former: 'former',
  actions: 'Actions',
  activity: 'Activity',
  convertToBill: 'Convert to bill',
  convertToBillFE2: 'Convert to bill — coming in FE-2',
  tryAgain: 'Try again',

  // FE-2 — view toggle + day picker
  viewMode: 'View',
  today: 'Today',
  previous: 'Previous',
  next: 'Next',

  // FE-2 — pickers
  pickParty: 'Pick a party',
  pickEmployee: 'Pick employee',
  searchParties: 'Search parties…',
  searchEmployees: 'Search employees…',
  noEmployeesMatch: 'No matches',
  employeeLoadFailed: 'Could not load employees',
  change: 'Change',
  clear: 'Clear',

  // FE-2 — recurrence
  recurrence: 'Recurrence',
  on: 'On',
  frequency: 'Frequency',
  every: 'Every',
  endsOn: 'Ends',
  repeatDaily: 'Daily',
  repeatWeekly: 'Weekly',
  repeatMonthly: 'Monthly',
  repeatNever: 'Never',
  until: 'Until',
  occurrences: 'Occurrences',
  recurrenceUntilBeforeStart: 'End date must be after the start',
  recurrenceSpanTooLong: 'Recurrence span is too long (max 365 days)',
  recurrenceOccurrencesTooMany: 'Too many occurrences (max 52)',
  recurrenceIntervalInvalid: 'Interval must be at least 1',

  // FE-2 — convert / waitlist
  convertToJob: 'Convert to job',
  convertToInvoice: 'Convert to invoice',
  conversionComingSoon: 'Conversion is rolling out — try again soon',
  convertHint: 'Generate a billable record from this appointment.',
  appointmentConverted: 'Appointment converted',
  idempotencyKey: 'Key',
  addToWaitlist: 'Add to waitlist',
  waitlistAdded: 'Added to waitlist',
  waitlistComingSoon: 'Waitlist is rolling out — try again soon',
  waitlistCurrent: 'Currently on waitlist',
  waitlistEmpty: 'Nobody on the waitlist for this slot.',

  // FE-2 — replay rejection banner
  slotTaken: 'Slot taken — pick another time',
  pickAnotherTime: 'Pick another time',
} as const
