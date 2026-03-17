/** Payment Service — Barrel re-export
 *
 * This file re-exports from the split service modules for backward compatibility.
 * New imports should target the specific module directly:
 *   - payment-crud.service.ts  → CRUD, allocations
 *   - outstanding.service.ts   → outstanding balances
 *   - reminder.service.ts      → payment reminders
 */

// ─── Payment CRUD & Allocations ───────────────────────────────────────────────
export {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  restorePayment,
  updateAllocations,
} from './payment-crud.service'

export type {
  AllocationInput,
  UpdateAllocationsRequest,
  UpdateAllocationsResponse,
} from './payment-crud.service'

// ─── Outstanding ──────────────────────────────────────────────────────────────
export {
  getOutstanding,
  getPartyOutstanding,
} from './outstanding.service'

// ─── Reminders ────────────────────────────────────────────────────────────────
export {
  sendReminder,
  sendBulkReminders,
  getReminders,
  getReminderConfig,
  updateReminderConfig,
} from './reminder.service'

export type {
  SendReminderRequest,
  SendBulkRemindersRequest,
  SendBulkRemindersResponse,
  ReminderFilters,
  ReminderListResponse,
} from './reminder.service'
