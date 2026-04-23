/** Shared Ledger — API service layer */

import { api } from '@/lib/api'
import type { LedgerShare, CreateLedgerShareData, PublicLedgerData } from './shared-ledger.types'

/** Create a new share link for a party's ledger */
export async function createLedgerShare(
  partyId: string,
  data: CreateLedgerShareData,
  signal?: AbortSignal,
): Promise<LedgerShare> {
  return api<LedgerShare>(`/parties/${partyId}/ledger/shares`, {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
    entityType: 'ledger-share',
    entityLabel: 'Create ledger share link',
  })
}

/** List all active shares for a party */
export async function listLedgerShares(
  partyId: string,
  signal?: AbortSignal,
): Promise<LedgerShare[]> {
  return api<LedgerShare[]>(`/parties/${partyId}/ledger/shares`, { signal })
}

/** Revoke (delete) a share */
export async function revokeLedgerShare(
  partyId: string,
  shareId: string,
  signal?: AbortSignal,
): Promise<void> {
  await api(`/parties/${partyId}/ledger/shares/${shareId}`, {
    method: 'DELETE',
    signal,
    entityType: 'ledger-share',
    entityLabel: 'Revoke ledger share',
  })
}

/** Fetch public ledger data (unauthenticated) */
export async function getPublicLedger(
  token: string,
  signal?: AbortSignal,
): Promise<PublicLedgerData> {
  return api<PublicLedgerData>(`/public/ledger/${token}`, { signal })
}
