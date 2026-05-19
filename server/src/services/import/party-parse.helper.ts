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
import type {
  ImportFormat,
  NormalizedPartyRow,
  RawPartyRow,
} from '../../types/import.types.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'

export interface StagedPartyRow {
  sourceIndex: number
  status: 'STAGED' | 'ERROR' | 'SKIPPED'
  raw: RawPartyRow['raw']
  normalized: NormalizedPartyRow
  matchedPartyId?: string
}

function classifyRow(n: NormalizedPartyRow): 'STAGED' | 'ERROR' {
  const hasFatal = n.issues.some((i) => i.code === 'MISSING_NAME')
  return hasFatal ? 'ERROR' : 'STAGED'
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

  return normalised.map((n) => {
    const exactHit = exact.get(n.sourceIndex)
    const nearHits = near.get(n.sourceIndex)
    const normalizedView: NormalizedPartyRow = {
      name: n.name,
      ...(n.phoneE164 ? { phoneE164: n.phoneE164 } : {}),
      ...(n.email ? { email: n.email } : {}),
      ...(n.gstin ? { gstin: n.gstin } : {}),
      ...(n.address ? { address: n.address } : {}),
      ...(n.openingBalancePaise !== undefined
        ? { openingBalancePaise: n.openingBalancePaise }
        : {}),
      issues: nearHits
        ? [
            ...n.issues,
            {
              field: 'name',
              code: 'NEAR_DUPLICATE',
              message: `Possibly matches existing party ${nearHits[0]!.name}`,
            },
          ]
        : n.issues,
    }
    const row: StagedPartyRow = {
      sourceIndex: n.sourceIndex,
      status: classifyRow(n),
      raw: n.raw,
      normalized: normalizedView,
    }
    if (exactHit) row.matchedPartyId = exactHit.partyId
    return row
  })
}
