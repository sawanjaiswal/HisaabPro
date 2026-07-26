/**
 * Phase 7 — Import Engine · Party parse + stage helper.
 *
 * Extracted from parse.service.ts during 7.1B to keep the orchestrator
 * file ≤250 LOC. Pure-ish: takes a Prisma client by argument (dedup
 * reads only), no audit writes.
 *
 * PII: NO raw cell content in any logger / audit call (S9).
 */

import { parseFile } from './parsers/index.js'
import { normalizePartyRow } from './normalizers/party-normalizer.js'
import {
  defaultMappingFor,
  type ColumnMapping,
} from './normalizers/normalize-mappings.js'
import { findExactDuplicates } from './dedup/exact-dedup.js'
import { findNearDuplicates } from './dedup/near-dedup.js'
import { findInFileDuplicates } from './dedup/in-file-dedup.js'
import type {
  ImportFormat,
  NormalizedPartyRow,
  RawPartyRow,
} from '../../types/import.types.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'

export type StagedRowStatus = 'STAGED' | 'ERROR' | 'SKIPPED' | 'DUPLICATE_EXACT'

export interface StagedPartyRow {
  sourceIndex: number
  status: StagedRowStatus
  raw: RawPartyRow['raw']
  normalized: NormalizedPartyRow
  matchedPartyId?: string
}

/**
 * The single place a row's fate is decided.
 *
 * Status is the only field the commit reads: its STAGED pass creates a party
 * unconditionally, and `DUPLICATE_*` rows are held back for the shopkeeper's
 * SKIP / OVERWRITE / CREATE_NEW decision. So a match that does not reach the
 * status changes nothing — the row is created a second time and Postgres'
 * (businessId, phone) unique index aborts the WHOLE commit, taking every other
 * row in the file with it.
 *
 * A near match deliberately stays STAGED. It is a fuzzy name similarity, not
 * an identity; blocking on it would silently drop real customers, and it
 * carries no matched party for an OVERWRITE to act on. It travels as an
 * advisory `NEAR_DUPLICATE` issue instead.
 */
function classifyRow(n: NormalizedPartyRow, isExactDuplicate: boolean): StagedRowStatus {
  const hasFatal = n.issues.some((i) => i.code === 'MISSING_NAME')
  if (hasFatal) return 'ERROR'
  return isExactDuplicate ? 'DUPLICATE_EXACT' : 'STAGED'
}

export function resolvePartyMapping(
  format: ImportFormat,
  override: ColumnMapping | undefined,
): ColumnMapping {
  if (override) return override
  const fallback = defaultMappingFor(format)
  if (!fallback) {
    throw new Error(
      `parse: column mapping is required for format=${format}`,
    )
  }
  return fallback
}

export async function buildStagedPartyRows(args: {
  buffer: Buffer
  format: ImportFormat
  mapping: ColumnMapping
  fileName?: string
  businessId: string
  prisma: ExtendedPrismaClient
}): Promise<StagedPartyRow[]> {
  const { buffer, format, mapping, fileName, businessId, prisma } = args
  const parsed = await parseFile(buffer, { format, fileName }, 'parties')

  const normalised: Array<
    NormalizedPartyRow & { sourceIndex: number; raw: RawPartyRow['raw'] }
  > = parsed.rows.map((r) => ({
    sourceIndex: r.sourceIndex,
    raw: r.raw,
    ...normalizePartyRow(r, mapping),
  }))

  const [exact, near] = await Promise.all([
    findExactDuplicates({ businessId, rows: normalised, prisma }),
    findNearDuplicates({ businessId, rows: normalised, prisma }),
  ])

  const inFile = findInFileDuplicates(normalised)

  return normalised.map((n) => {
    const exactHit = exact.get(n.sourceIndex)
    const nearHits = near.get(n.sourceIndex)
    const inFileHit = inFile.get(n.sourceIndex)
    const extraIssues = [
      ...(nearHits
        ? [
            {
              field: 'name',
              code: 'NEAR_DUPLICATE',
              message: `Possibly matches existing party ${nearHits[0]!.name}`,
            },
          ]
        : []),
      ...(inFileHit
        ? [
            {
              field: inFileHit.matchedField,
              code: 'DUPLICATE_IN_FILE',
              message: `Same ${inFileHit.matchedField} as row ${inFileHit.duplicateOf + 1} of this file`,
            },
          ]
        : []),
    ]
    const normalizedView: NormalizedPartyRow = {
      name: n.name,
      ...(n.phone ? { phone: n.phone } : {}),
      ...(n.email ? { email: n.email } : {}),
      ...(n.gstin ? { gstin: n.gstin } : {}),
      ...(n.address ? { address: n.address } : {}),
      ...(n.openingBalancePaise !== undefined
        ? { openingBalancePaise: n.openingBalancePaise }
        : {}),
      issues: extraIssues.length > 0 ? [...n.issues, ...extraIssues] : n.issues,
    }
    const row: StagedPartyRow = {
      sourceIndex: n.sourceIndex,
      status: classifyRow(n, Boolean(exactHit) || Boolean(inFileHit)),
      raw: n.raw,
      normalized: normalizedView,
    }
    if (exactHit) row.matchedPartyId = exactHit.partyId
    return row
  })
}
