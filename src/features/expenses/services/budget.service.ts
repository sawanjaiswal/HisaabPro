/** Expenses — Budget service (frontend) */

import { api } from '@/lib/api'
import type { BudgetUsageItem, CreateBudgetInput, BudgetCheckResult } from '../expense.types'

function replayHeaders(): HeadersInit {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': String(Date.now()),
  }
}

/** Returns budgets + utilization for a given YYYY-MM month */
export async function listBudgets(
  month: string,
  signal?: AbortSignal
): Promise<BudgetUsageItem[]> {
  const params = new URLSearchParams({ month })
  // The server returns { budgets, utilization } — we merge on the utilization shape
  const data = await api<{ budgets?: BudgetUsageItem[]; utilization?: BudgetUsageItem[] }>(
    `/expenses/budgets?${params}`,
    { signal }
  )
  // Server may return either shape depending on build; normalise
  return data.utilization ?? data.budgets ?? []
}

export async function upsertBudget(input: CreateBudgetInput): Promise<BudgetUsageItem> {
  return api<BudgetUsageItem>('/expenses/budgets', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    entityType: 'expense',
    entityLabel: 'Budget',
  })
}

export async function updateBudget(
  id: string,
  amount: number
): Promise<BudgetUsageItem> {
  return api<BudgetUsageItem>(`/expenses/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ amount }),
    headers: replayHeaders(),
    entityType: 'expense',
    entityLabel: 'Update budget',
  })
}

export async function deleteBudget(id: string): Promise<{ deleted: true }> {
  return api<{ deleted: true }>(`/expenses/budgets/${id}`, {
    method: 'DELETE',
    headers: replayHeaders(),
    entityType: 'expense',
    entityLabel: 'Delete budget',
  })
}

/** Advisory check: would adding `amount` paise to `categoryId` exceed the budget? */
export async function checkBudget(
  categoryId: string | null,
  amount: number,
  signal?: AbortSignal
): Promise<BudgetCheckResult> {
  const params = new URLSearchParams({ amount: String(amount) })
  if (categoryId) params.set('categoryId', categoryId)
  return api<BudgetCheckResult>(`/expenses/budgets/check?${params}`, { signal })
}
