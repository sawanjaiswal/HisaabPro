/** Bulk Import Parties — Type definitions */

import type { PartyType } from '@/lib/types/party.types'

export type BulkImportStatus = 'idle' | 'picking' | 'preview' | 'importing' | 'done' | 'error'

/** A contact from the phone's contact picker or CSV */
export interface ImportedContact {
  /** Unique key for this contact within the import batch */
  id: string
  name: string
  phone: string
  email?: string
  /** Whether this contact is selected for import */
  isSelected: boolean
  /** Validation error (if any) */
  error?: string
}

/** A party ready to be created from an imported contact */
export interface BulkPartyData {
  name: string
  phone: string
  email?: string
  type: PartyType
}

export interface BulkImportResult {
  total: number
  succeeded: number
  failed: number
  errors: Array<{ name: string; reason: string }>
}
