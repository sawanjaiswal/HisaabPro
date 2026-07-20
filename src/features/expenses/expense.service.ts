/** Expenses — API service layer */

import { api } from '@/lib/api'
import type {
  Expense,
  ExpenseCategory,
  ExpenseListResponse,
  ExpenseSummary,
  CreateExpenseInput,
  CreateExpenseCategoryInput,
  OcrResponse,
  PendingExpenseItem,
} from './expense.types'
import { EXPENSE_PAGE_LIMIT } from './expense.constants'

function replayHeaders(): HeadersInit {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': String(Date.now()),
  }
}

export async function listExpenses(
  page: number,
  categoryId: string | null,
  signal?: AbortSignal,
  /** Local ISO date — the "This month" segment (#10) narrows server-side. */
  from?: string,
): Promise<ExpenseListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(EXPENSE_PAGE_LIMIT) })
  if (categoryId) params.set('categoryId', categoryId)
  if (from) params.set('from', from)
  return api<ExpenseListResponse>(`/expenses?${params}`, { signal })
}

export async function getExpense(id: string, signal?: AbortSignal): Promise<Expense> {
  return api<Expense>(`/expenses/${id}`, { signal })
}

export async function createExpense(
  input: CreateExpenseInput,
  signal?: AbortSignal
): Promise<Expense> {
  return api<Expense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'expense',
    entityLabel: input.notes ?? 'New expense',
  })
}

export async function updateExpense(
  id: string,
  input: Partial<CreateExpenseInput>,
  signal?: AbortSignal,
): Promise<Expense> {
  return api<Expense>(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'expense',
    entityLabel: input.notes ?? 'Edit expense',
  })
}

export async function deleteExpense(id: string, signal?: AbortSignal): Promise<void> {
  return api<void>(`/expenses/${id}`, {
    method: 'DELETE',
    headers: replayHeaders(),
    signal,
    entityType: 'expense',
    entityLabel: 'Delete expense',
  })
}

export async function listExpenseCategories(
  signal?: AbortSignal
): Promise<ExpenseCategory[]> {
  return api<ExpenseCategory[]>('/expenses/categories', { signal })
}

export async function createExpenseCategory(
  input: CreateExpenseCategoryInput,
  signal?: AbortSignal
): Promise<ExpenseCategory> {
  return api<ExpenseCategory>('/expenses/categories', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'expense-category',
    entityLabel: input.name ?? 'New category',
  })
}

export async function seedExpenseCategories(signal?: AbortSignal): Promise<void> {
  return api<void>('/expenses/categories/seed', {
    method: 'POST',
    headers: replayHeaders(),
    signal,
    entityType: 'expense-category',
    entityLabel: 'Seed default categories',
  })
}

export async function getExpenseSummary(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<ExpenseSummary> {
  const params = new URLSearchParams({ from, to })
  return api<ExpenseSummary>(`/expenses/summary?${params}`, { signal })
}

export async function listPendingExpenses(signal?: AbortSignal): Promise<PendingExpenseItem[]> {
  return api<PendingExpenseItem[]>('/expenses/pending', { signal })
}

export async function confirmExpense(id: string, label: string): Promise<{ id: string; status: 'CONFIRMED' }> {
  return api<{ id: string; status: 'CONFIRMED' }>(`/expenses/${id}/confirm`, {
    method: 'POST',
    headers: replayHeaders(),
    entityType: 'expense',
    entityLabel: `Confirm ${label}`,
  })
}

export async function skipExpense(id: string, label: string): Promise<void> {
  return api<void>(`/expenses/${id}/skip`, {
    method: 'POST',
    headers: replayHeaders(),
    entityType: 'expense',
    entityLabel: `Skip ${label}`,
  })
}

export async function ocrReceipt(
  base64Image: string,
  mimeType: string,
  signal?: AbortSignal
): Promise<OcrResponse> {
  return api<OcrResponse>('/expenses/ocr', {
    method: 'POST',
    body: JSON.stringify({ base64Image, mimeType }),
    signal,
    // Never queue OCR offline — result is PII and time-sensitive
  })
}
