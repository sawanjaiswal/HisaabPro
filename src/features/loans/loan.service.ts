/** Loans — API service layer */

import { api } from '@/lib/api'
import type {
  Loan,
  LoanListResponse,
  LoanStatement,
  CreateLoanInput,
  CreateLoanTransactionInput,
} from './loan.types'

function replayHeaders(): HeadersInit {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': String(Date.now()),
  }
}

export async function listLoans(signal?: AbortSignal): Promise<LoanListResponse> {
  return api<LoanListResponse>('/loans', { signal })
}

export async function getLoan(id: string, signal?: AbortSignal): Promise<Loan> {
  return api<Loan>(`/loans/${id}`, { signal })
}

export async function getLoanStatement(
  id: string,
  signal?: AbortSignal
): Promise<LoanStatement> {
  return api<LoanStatement>(`/loans/${id}/statement`, { signal })
}

export async function createLoan(
  input: CreateLoanInput,
  signal?: AbortSignal
): Promise<Loan> {
  return api<Loan>('/loans', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'loan',
    entityLabel: input.notes ?? `New ${input.loanType.toLowerCase()} loan`,
  })
}

export async function recordLoanTransaction(
  loanId: string,
  input: CreateLoanTransactionInput,
  signal?: AbortSignal
): Promise<Loan> {
  return api<Loan>(`/loans/${loanId}/transactions`, {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'loan-transaction',
    entityLabel: input.type ? `Record ${input.type.toLowerCase()}` : 'Loan transaction',
  })
}

export async function closeLoan(id: string, signal?: AbortSignal): Promise<Loan> {
  return api<Loan>(`/loans/${id}/close`, {
    method: 'POST',
    headers: replayHeaders(),
    signal,
    entityType: 'loan',
    entityLabel: 'Close loan',
  })
}
