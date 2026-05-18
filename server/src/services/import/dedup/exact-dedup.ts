/**
 * Phase 7 — Import Engine · Exact-duplicate detection
 *
 * For each normalized row, find an existing `Party` in the SAME business
 * that matches on `phoneE164` OR `gstin`. Single Prisma `findMany` is
 * scoped strictly to `businessId = :biz` so a malicious or buggy caller
 * cannot enumerate parties across tenants (SECURITY_AUDIT M1 / S5).
 *
 * Pure-ish: takes a Prisma client by argument so unit tests can pass a
 * mock. Returns a `Map<sourceIndex, ExactMatch>` consumed by the import
 * preview service.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md File Plan row 15
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M1 (auth helper) / S5
 */

import type { NormalizedPartyRow } from '../../../types/import.types.js'
import type { ExtendedPrismaClient } from '../../../lib/prisma.js'

export interface ExactMatch {
  partyId: string
  matchedField: 'phone' | 'gstin'
  partyName: string
}

export interface FindExactArgs {
  businessId: string
  rows: Array<NormalizedPartyRow & { sourceIndex: number }>
  prisma: Pick<ExtendedPrismaClient, 'party'>
}

/**
 * Build a Map<sourceIndex, ExactMatch> for rows whose phone or gstin
 * already exists in the business's `Party` table.
 *
 * Order of preference when a row matches BOTH a phone-only and a
 * gstin-only existing party: phone wins (phone is the HP primary dedup
 * key per ARCH §5).
 */
export async function findExactDuplicates(
  args: FindExactArgs,
): Promise<Map<number, ExactMatch>> {
  const { businessId, rows, prisma } = args
  const out = new Map<number, ExactMatch>()
  if (rows.length === 0) return out

  // Collect the lookup sets — dedupe within the batch first.
  const phones = new Set<string>()
  const gstins = new Set<string>()
  for (const r of rows) {
    if (r.phoneE164) phones.add(r.phoneE164)
    if (r.gstin) gstins.add(r.gstin)
  }
  if (phones.size === 0 && gstins.size === 0) return out

  const orClauses: Array<{ phone?: { in: string[] }; gstin?: { in: string[] } }> = []
  if (phones.size > 0) orClauses.push({ phone: { in: Array.from(phones) } })
  if (gstins.size > 0) orClauses.push({ gstin: { in: Array.from(gstins) } })

  const existing = await prisma.party.findMany({
    where: {
      businessId, // tenancy guard — non-negotiable
      isDeleted: false,
      OR: orClauses,
    },
    select: { id: true, name: true, phone: true, gstin: true },
  })

  // Build phone / gstin → Party lookup tables. Last-write-wins is fine;
  // duplicate phones inside a single business are themselves a data bug.
  const byPhone = new Map<string, { id: string; name: string }>()
  const byGstin = new Map<string, { id: string; name: string }>()
  for (const p of existing) {
    if (p.phone) byPhone.set(p.phone, { id: p.id, name: p.name })
    if (p.gstin) byGstin.set(p.gstin, { id: p.id, name: p.name })
  }

  for (const r of rows) {
    if (r.phoneE164) {
      const hit = byPhone.get(r.phoneE164)
      if (hit) {
        out.set(r.sourceIndex, {
          partyId: hit.id,
          matchedField: 'phone',
          partyName: hit.name,
        })
        continue
      }
    }
    if (r.gstin) {
      const hit = byGstin.get(r.gstin)
      if (hit) {
        out.set(r.sourceIndex, {
          partyId: hit.id,
          matchedField: 'gstin',
          partyName: hit.name,
        })
      }
    }
  }
  return out
}
