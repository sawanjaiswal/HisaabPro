/**
 * Phase 7 — Import Engine · Near-duplicate detection (Levenshtein)
 *
 * For rows that did NOT exact-match, look for similar parties in the
 * SAME business by bucketing on the last 4 digits of phone, then
 * scoring name similarity with Levenshtein-normalised distance.
 * Threshold ≥ 0.85 makes "Raju Traders" vs "Raju Trader" surface, but
 * "Raju" vs "Priya" does not.
 *
 * Cost budget: ≤50 unique phone-suffix buckets per call (configurable),
 * each one `Party.findMany` filtered by businessId + phone LIKE
 * '%<suffix>'. Linear-scan + Levenshtein O(n*m) on names is fine for the
 * sub-10k row cap; switching to pg-trgm GIN is FUTURE_EPIC F4.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md File Plan row 16
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S5 / M1 (businessId-scoped)
 */

import type { NormalizedPartyRow } from '../../../types/import.types.js'
import type { ExtendedPrismaClient } from '../../../lib/prisma.js'

export interface NearMatch {
  partyId: string
  score: number
  name: string
}

export interface FindNearArgs {
  businessId: string
  rows: Array<NormalizedPartyRow & { sourceIndex: number }>
  prisma: Pick<ExtendedPrismaClient, 'party'>
  /** Override only for tests. Default = 50. */
  maxBuckets?: number
  /** Override only for tests. Default = 0.85. */
  threshold?: number
}

const DEFAULT_MAX_BUCKETS = 50
const DEFAULT_THRESHOLD = 0.85
const SUFFIX_LEN = 4

/**
 * Classic two-row Levenshtein. ~20 lines, no external dep — for the
 * row-counts we expect (≤10k × ≤50 candidates × short names) this is
 * well under the 5s normalize+dedup budget in ARCH §7.1.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const m = a.length
  const n = b.length
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j += 1) prev[j] = j
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1]! + 1, // insertion
        prev[j]! + 1, // deletion
        prev[j - 1]! + cost, // substitution
      )
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]!
}

/** 1.0 = identical, 0.0 = entirely different. */
export function nameSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim()
  const lb = b.toLowerCase().trim()
  if (!la && !lb) return 1
  const longer = Math.max(la.length, lb.length)
  if (longer === 0) return 1
  return 1 - levenshtein(la, lb) / longer
}

function phoneSuffix(phoneE164: string): string {
  return phoneE164.slice(-SUFFIX_LEN)
}

export async function findNearDuplicates(
  args: FindNearArgs,
): Promise<Map<number, NearMatch[]>> {
  const {
    businessId,
    rows,
    prisma,
    maxBuckets = DEFAULT_MAX_BUCKETS,
    threshold = DEFAULT_THRESHOLD,
  } = args
  const out = new Map<number, NearMatch[]>()
  if (rows.length === 0) return out

  // Group rows by phone-suffix bucket. Skip rows without a phone — near
  // dedup is only sensible when we have at least the suffix to scope.
  const byBucket = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!r.phoneE164) continue
    const sfx = phoneSuffix(r.phoneE164)
    const arr = byBucket.get(sfx) ?? []
    arr.push(r)
    byBucket.set(sfx, arr)
  }
  if (byBucket.size === 0) return out

  // Cap bucket fan-out — security & cost guard.
  const bucketKeys = Array.from(byBucket.keys()).slice(0, maxBuckets)

  for (const suffix of bucketKeys) {
    const bucketRows = byBucket.get(suffix)!
    const candidates = await prisma.party.findMany({
      where: {
        businessId, // tenancy guard
        isDeleted: false,
        phone: { endsWith: suffix },
      },
      select: { id: true, name: true, phone: true },
      take: 200, // hard cap per bucket — pathological data won't OOM
    })
    if (candidates.length === 0) continue

    for (const r of bucketRows) {
      const matches: NearMatch[] = []
      for (const c of candidates) {
        const score = nameSimilarity(r.name, c.name)
        if (score >= threshold) {
          matches.push({ partyId: c.id, score, name: c.name })
        }
      }
      if (matches.length > 0) {
        matches.sort((a, b) => b.score - a.score)
        out.set(r.sourceIndex, matches.slice(0, 5))
      }
    }
  }
  return out
}
