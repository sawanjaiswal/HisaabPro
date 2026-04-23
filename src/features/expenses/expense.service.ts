/** Expenses — API service layer */

import { api } from '@/lib/api'
import type {
  Expense,
  ExpenseCategory,
  ExpenseListResponse,
  ExpenseSummary,
  CreateExpenseInput,
  CreateExpenseCategoryInput,
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
  signal?: AbortSignal
): Promise<ExpenseListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(EXPENSE_PAGE_LIMIT) })
  if (categoryId) params.set('categoryId', categoryId)
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
