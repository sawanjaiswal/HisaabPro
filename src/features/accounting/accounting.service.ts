/** Accounting — API service layer
 *
 * All amounts are in paise. Display conversion at component layer.
 * Every function accepts AbortSignal for hook cleanup.
 */

import { api } from '@/lib/api'
import { buildAccountingQuery } from './accounting.utils'
import type {
  AccountListResponse,
  JournalEntryListResponse,
  JournalEntry,
  LedgerAccount,
  TrialBalanceData,
  JournalEntryFilters,
} from './accounting.types'

// ─── Chart of Accounts ─────────────────────────────────────────────────────────

export async function getAccounts(
  page = 1,
  limit = 100,
  signal?: AbortSignal
): Promise<AccountListResponse> {
  const query = buildAccountingQuery({ page, limit })
  return api<AccountListResponse>(`/accounting/accounts?${query}`, { signal })
}

export async function getAccountById(
  id: string,
  signal?: AbortSignal
): Promise<LedgerAccount> {
  return api<LedgerAccount>(`/accounting/accounts/${id}`, { signal })
}

export async function seedDefaultAccounts(signal?: AbortSignal): Promise<void> {
  return api<void>('/accounting/accounts/seed', { method: 'POST', signal })
}

export async function createAccount(
  data: {
    code: string
    name: string
    type: string
    subType?: string
    parentId?: string
    description?: string
  },
  signal?: AbortSignal
): Promise<LedgerAccount> {
  return api<LedgerAccount>('/accounting/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

// ─── Journal Entries ───────────────────────────────────────────────────────────

export async function getJournalEntries(
  filters: JournalEntryFilters,
  signal?: AbortSignal
): Promise<JournalEntryListResponse> {
  const query = buildAccountingQuery(
    filters as unknown as Record<string, string | number | undefined>
  )
  return api<JournalEntryListResponse>(`/accounting/entries?${query}`, { signal })
}

export async function getJournalEntryById(
  id: string,
  signal?: AbortSignal
): Promise<JournalEntry> {
  return api<JournalEntry>(`/accounting/entries/${id}`, { signal })
}

export async function postJournalEntry(
  id: string,
  signal?: AbortSignal
): Promise<JournalEntry> {
  return api<JournalEntry>(`/accounting/entries/${id}/post`, {
    method: 'POST',
    signal,
  })
}

export async function voidJournalEntry(
  id: string,
  signal?: AbortSignal
): Promise<JournalEntry> {
  return api<JournalEntry>(`/accounting/entries/${id}/void`, {
    method: 'POST',
    signal,
  })
}

// ─── Reports ───────────────────────────────────────────────────────────────────

export async function getTrialBalance(
  asOf?: string,
  signal?: AbortSignal
): Promise<TrialBalanceData> {
  const query = asOf ? `asOf=${encodeURIComponent(asOf)}` : ''
  return api<TrialBalanceData>(
    `/accounting/reports/trial-balance${query ? `?${query}` : ''}`,
    { signal }
  )
}

export async function getLedgerReport(
  accountId: string,
  from?: string,
  to?: string,
  signal?: AbortSignal
): Promise<unknown> {
  const query = buildAccountingQuery({ from, to })
  return api<unknown>(
    `/accounting/reports/ledger/${accountId}${query ? `?${query}` : ''}`,
    { signal }
  )
}

export async function getDayBookAccounting(
  date: string,
  signal?: AbortSignal
): Promise<unknown> {
  return api<unknown>(
    `/accounting/reports/day-book?date=${encodeURIComponent(date)}`,
    { signal }
  )
}
