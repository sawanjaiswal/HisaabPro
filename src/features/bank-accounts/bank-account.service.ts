/** Bank Accounts — API service layer */

import { api } from '@/lib/api'
import type {
  BankAccount,
  BankAccountListResponse,
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from './bank-account.types'

function replayHeaders(): HeadersInit {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': String(Date.now()),
  }
}

export async function listBankAccounts(
  signal?: AbortSignal
): Promise<BankAccountListResponse> {
  return api<BankAccountListResponse>('/bank-accounts', { signal })
}

export async function getBankAccount(
  id: string,
  signal?: AbortSignal
): Promise<BankAccount> {
  return api<BankAccount>(`/bank-accounts/${id}`, { signal })
}

export async function createBankAccount(
  input: CreateBankAccountInput,
  signal?: AbortSignal
): Promise<BankAccount> {
  return api<BankAccount>('/bank-accounts', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
  })
}

export async function updateBankAccount(
  id: string,
  input: UpdateBankAccountInput,
  signal?: AbortSignal
): Promise<BankAccount> {
  return api<BankAccount>(`/bank-accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
  })
}

export async function deleteBankAccount(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/bank-accounts/${id}`, {
    method: 'DELETE',
    headers: replayHeaders(),
    signal,
  })
}
