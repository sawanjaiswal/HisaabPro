/**
 * Party tags aggregate — GET /api/parties/tags (architecture §3.5, §17.2).
 *
 * Returns each distinct tag with its party count + headline counts for the
 * tag-filter bar (total parties with at least one tag, total without).
 * Tags live on `Party.tags String[]` — Postgres array column. Aggregation
 * uses `prisma.$queryRaw` because Prisma's typed groupBy cannot unnest
 * arrays. Two queries total (tags aggregate + tagged/untagged counts),
 * both indexed by `(businessId)` on Party.
 *
 * Cross-tenant safety: businessId always pinned via parameterised query.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import type {
  TagSummary,
  TagSummaryPage,
} from '../../types/party-crm.types.js'

interface TagRow {
  tag: string
  party_count: bigint
}

interface ScoreRow {
  with_tags: bigint
  without_tags: bigint
}

/**
 * Aggregate tags across active parties for a business.
 * Sorted by partyCount desc, then alphabetically. Capped at 200 distinct tags
 * (defensive cap — the create-party schema allows up to 50 tags/party with a
 * 50-char limit, so the practical realm is < 200 even on the largest tenant).
 */
export async function listTagSummary(businessId: string): Promise<TagSummaryPage> {
  const [tagRows, scores] = await Promise.all([
    prisma.$queryRaw<TagRow[]>`
      SELECT tag,
             COUNT(DISTINCT "Party"."id")::bigint AS party_count
      FROM "Party",
           UNNEST("Party"."tags") AS tag
      WHERE "Party"."businessId" = ${businessId}
        AND "Party"."isActive" = true
      GROUP BY tag
      ORDER BY party_count DESC, tag ASC
      LIMIT 200
    `,
    prisma.$queryRaw<ScoreRow[]>`
      SELECT
        SUM(CASE WHEN array_length("Party"."tags", 1) > 0 THEN 1 ELSE 0 END)::bigint AS with_tags,
        SUM(CASE WHEN array_length("Party"."tags", 1) IS NULL OR array_length("Party"."tags", 1) = 0 THEN 1 ELSE 0 END)::bigint AS without_tags
      FROM "Party"
      WHERE "Party"."businessId" = ${Prisma.sql`${businessId}`}
        AND "Party"."isActive" = true
    `,
  ])

  const tags: TagSummary[] = tagRows.map((row) => ({
    tag: row.tag,
    partyCount: Number(row.party_count),
  }))

  const headline = scores[0] ?? { with_tags: BigInt(0), without_tags: BigInt(0) }

  return {
    tags,
    totalPartiesWithTags: Number(headline.with_tags),
    totalPartiesWithoutTags: Number(headline.without_tags),
  }
}
