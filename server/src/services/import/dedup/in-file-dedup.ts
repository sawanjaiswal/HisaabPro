/**
 * Phase 7 — Import Engine · Duplicates *within one file*
 *
 * `exact-dedup.ts` answers "does this customer already exist in the shop's
 * ledger". It cannot answer "does this file list the same customer twice" —
 * and real exports do that constantly (a shop and its owner under one number,
 * a customer re-entered by a second staff member). Both rows would be staged
 * as new, the second `party.create` would hit the (businessId, phone) unique
 * index, and the whole commit transaction would abort.
 *
 * The FIRST occurrence stays committable; every later one is a duplicate of a
 * row in the same file. Rows are visited in source order so "first" means the
 * line the shopkeeper would point at.
 */

import type { NormalizedPartyRow } from '../../../types/import.types.js'

export interface InFileDuplicate {
  /** sourceIndex of the earlier row this one repeats. */
  duplicateOf: number
  matchedField: 'phone' | 'gstin'
}

/**
 * Map<sourceIndex, InFileDuplicate> for every row that repeats an earlier
 * row's phone or GSTIN. Rows with neither field cannot duplicate — two
 * customers may legitimately share a name.
 */
export function findInFileDuplicates(
  rows: Array<Pick<NormalizedPartyRow, 'phone' | 'gstin'> & { sourceIndex: number }>,
): Map<number, InFileDuplicate> {
  const out = new Map<number, InFileDuplicate>()
  const byPhone = new Map<string, number>()
  const byGstin = new Map<string, number>()

  for (const r of [...rows].sort((a, b) => a.sourceIndex - b.sourceIndex)) {
    const phoneHit = r.phone ? byPhone.get(r.phone) : undefined
    if (phoneHit !== undefined) {
      out.set(r.sourceIndex, { duplicateOf: phoneHit, matchedField: 'phone' })
      continue
    }
    const gstinHit = r.gstin ? byGstin.get(r.gstin) : undefined
    if (gstinHit !== undefined) {
      out.set(r.sourceIndex, { duplicateOf: gstinHit, matchedField: 'gstin' })
      continue
    }
    if (r.phone) byPhone.set(r.phone, r.sourceIndex)
    if (r.gstin) byGstin.set(r.gstin, r.sourceIndex)
  }
  return out
}
