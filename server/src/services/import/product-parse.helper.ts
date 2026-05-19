/**
 * Phase 7 · 7.1B — Product parse + stage helper.
 *
 * Sibling of parse.service.ts. Owns the product branch of the
 * `parse + normalize + dedup` pipeline so parse.service.ts stays
 * ≤250 LOC.
 *
 * PII: logger / audit calls MUST NOT include raw cell content —
 * only jobId, sourceIndex, code, field (S9).
 */

import { parseFile } from './parsers/index.js'
import { normalizeProductRow } from './normalizers/product-normalizer.js'
import { defaultProductMappingFor } from './normalizers/product-mappings.js'
import type { ProductColumnMapping } from './normalizers/product-mappings.js'
import { exactSkuMatch, trgmNameMatch } from './dedup/product-dedup.js'
import { serializeNormalizedProduct } from '../../utils/json-bigint.js'
import type {
  ImportFormat,
  NormalizedProduct,
  RawProductRow,
} from '../../types/import.types.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'

export interface StagedProductRow {
  sourceIndex: number
  status: 'STAGED' | 'ERROR' | 'SKIPPED'
  raw: RawProductRow['raw']
  /** M5-serialised: BigInt → string before JSONB persist. */
  normalized: Record<string, unknown>
  matchedPartyId?: string
}

function classifyProductRow(n: NormalizedProduct): 'STAGED' | 'ERROR' {
  // Name is the only hard requirement. Unit/price problems surface as
  // chips on the preview but still stage for commit.
  const hasFatal = n.issues.some((i) => i.code === 'NAME_REQUIRED')
  return hasFatal ? 'ERROR' : 'STAGED'
}

export function resolveProductMapping(
  format: ImportFormat,
  override: ProductColumnMapping | undefined,
): ProductColumnMapping {
  if (override) return override
  const fallback = defaultProductMappingFor(format)
  if (!fallback) {
    throw new Error(
      `parse: product column mapping required for format=${format}`,
    )
  }
  return fallback
}

export async function buildStagedProductRows(args: {
  buffer: Buffer
  format: ImportFormat
  mapping: ProductColumnMapping
  fileName?: string
  businessId: string
  prisma: ExtendedPrismaClient
}): Promise<StagedProductRow[]> {
  const { buffer, format, mapping, fileName, businessId, prisma } = args
  const parsed = await parseFile(buffer, { format, fileName }, 'product')
  // Parser produces RawProductRow (cast at the boundary in each parser).
  const rawRows = parsed.rows as unknown as RawProductRow[]
  const normalised: Array<NormalizedProduct & {
    sourceIndex: number
    raw: RawProductRow['raw']
  }> = rawRows.map((r) => ({
    sourceIndex: r.sourceIndex,
    raw: r.raw,
    ...normalizeProductRow(r, mapping),
  }))

  // Dedup — both passes strictly scoped by businessId.
  const [exact, near] = await Promise.all([
    exactSkuMatch({ businessId, rows: normalised, prisma }),
    trgmNameMatch({ businessId, rows: normalised, prisma }),
  ])

  return normalised.map((n) => {
    const exactHit = exact.get(n.sourceIndex)
    const nearHits = near.get(n.sourceIndex)
    const issuesWithDedup = nearHits
      ? [
          ...n.issues,
          {
            field: 'name',
            code: 'NEAR_DUPLICATE',
            message: `Possibly matches existing product ${nearHits[0]!.name}`,
          },
        ]
      : n.issues
    const view: NormalizedProduct = {
      ...n,
      issues: issuesWithDedup,
    }
    const out: StagedProductRow = {
      sourceIndex: n.sourceIndex,
      status: classifyProductRow(n),
      raw: n.raw,
      // M5: serialise BigInt → string before JSONB persist.
      normalized: serializeNormalizedProduct(view) as Record<string, unknown>,
    }
    if (exactHit) out.matchedPartyId = exactHit.productId
    return out
  })
}
