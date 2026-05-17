/**
 * Commission #128 — Accrual service. Called INSIDE the POS / Document
 * `$transaction` (architecture §3.1 + §3.3). Never opens its own tx.
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md
 *   §4.2 — M1 deep clone of ruleSnapshot (callout box)
 *   §4.5 — PRODUCT > CATEGORY > ALL specificity
 *   §3.2 + §3.4.1 — void / restore symmetry (negation chain)
 *
 * Three public entries:
 *   accrueForPosSale   → POS path; reads PosSaleItem + Product, picks
 *                         winning rule per line, writes one ledger row per
 *                         (line, rule) match. Each row carries a DEEP-CLONED
 *                         `meta.ruleSnapshot`.
 *   accrueForDocument  → SALE_INVOICE path; same logic over DocumentLineItem.
 *   reverseForPosSale  → reads existing CommissionLedger rows for the sale,
 *                         writes ONE inverse-paise VOID row per source row,
 *                         carrying a deep clone OF THE SOURCE ROW'S snapshot
 *                         (NOT the live rule — §4.2 M1 invariant). Idempotent.
 *   restoreForPosSale  → reads VOID rows, writes inverse-paise RESTORE rows,
 *                         each carrying a deep clone OF THE VOID ROW'S snapshot
 *                         (chain unbroken). Idempotent.
 *
 * §17.3 deep-clone grep test: `git grep -n "JSON.parse(JSON.stringify"
 *   server/src/services/commission/` MUST return ≥ 2 matches — they live in
 *   commission-snapshot.utils.ts (forward + void/restore) and are wired
 *   through this service.
 */

import type { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { listRules } from './commission-rule.service.js'
import {
  cloneRuleSnapshot,
  type CommissionRuleSnapshot,
} from './commission-snapshot.utils.js'
import {
  filterApplicableRules,
  pickRuleForLine,
  computeCommissionPaise,
  type CommissionSource,
  type MatchableLine,
} from './commission-match.utils.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

// ─── Period helper ─────────────────────────────────────────────────────────

/** YYYY-MM in business UTC. Caller passes saleDate / documentDate. */
function periodYearMonth(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0')
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${y}-${m}`
}

// ─── Public API — POS ──────────────────────────────────────────────────────

export interface AccrueForPosSaleArgs {
  businessId: string
  /** Staff who rang the sale (PosSale.cashierId). */
  staffUserId: string
  posSaleId: string
  saleDate: Date
}

export interface AccrueResult {
  rowsWritten: number
  totalCommissionPaise: number
}

export async function accrueForPosSale(
  tx: TxClient,
  args: AccrueForPosSaleArgs
): Promise<AccrueResult> {
  // 1. Active rules for this business (already isActive=true, sorted desc rank).
  const rules = await listRules(args.businessId, { includeInactive: false })
  if (rules.length === 0) return { rowsWritten: 0, totalCommissionPaise: 0 }

  // 2. POS line snapshot — read items + product.categoryId in one round-trip.
  const items = await tx.posSaleItem.findMany({
    where: { posSaleId: args.posSaleId },
    select: {
      productId: true,
      quantity: true,
      lineTotal: true,
      taxableValue: true,
      product: { select: { categoryId: true } },
    },
  })
  if (items.length === 0) return { rowsWritten: 0, totalCommissionPaise: 0 }

  const lines: MatchableLine[] = items.map(it => ({
    productId: it.productId,
    categoryId: it.product?.categoryId ?? null,
    quantity: it.quantity,
    // PERCENT_GROSS rules use pre-discount basis; PERCENT_NET uses post-discount.
    // We pass post-discount `taxableValue` here (matches §4.1 worked example);
    // mode-specific basis switching lives in match.utils via pickRule’s flag.
    basisPaise: it.taxableValue,
  }))

  return writeAccrualRows(tx, args.businessId, args.staffUserId, 'POS', rules, lines, {
    posSaleId: args.posSaleId,
    documentId: null,
    saleDate: args.saleDate,
  })
}

// ─── Public API — Document (SALE_INVOICE) ───────────────────────────────────

export interface AccrueForDocumentArgs {
  businessId: string
  /** Staff who created the invoice (Document.createdBy). */
  staffUserId: string
  documentId: string
  documentDate: Date
}

export async function accrueForDocument(
  tx: TxClient,
  args: AccrueForDocumentArgs
): Promise<AccrueResult> {
  const rules = await listRules(args.businessId, { includeInactive: false })
  if (rules.length === 0) return { rowsWritten: 0, totalCommissionPaise: 0 }

  const items = await tx.documentLineItem.findMany({
    where: { documentId: args.documentId },
    select: {
      productId: true,
      quantity: true,
      lineTotal: true,
      taxableValue: true,
      product: { select: { categoryId: true } },
    },
  })
  if (items.length === 0) return { rowsWritten: 0, totalCommissionPaise: 0 }

  const lines: MatchableLine[] = items.map(it => ({
    productId: it.productId,
    categoryId: it.product?.categoryId ?? null,
    quantity: it.quantity,
    basisPaise: it.taxableValue,
  }))

  return writeAccrualRows(tx, args.businessId, args.staffUserId, 'INVOICE', rules, lines, {
    posSaleId: null,
    documentId: args.documentId,
    saleDate: args.documentDate,
  })
}

// ─── Shared accrual writer ─────────────────────────────────────────────────

interface AccrualLink {
  posSaleId: string | null
  documentId: string | null
  saleDate: Date
}

async function writeAccrualRows(
  tx: TxClient,
  businessId: string,
  staffUserId: string,
  channel: CommissionSource,
  rules: Awaited<ReturnType<typeof listRules>>,
  lines: MatchableLine[],
  link: AccrualLink
): Promise<AccrueResult> {
  const applicable = filterApplicableRules(rules, channel, staffUserId)
  if (applicable.length === 0) return { rowsWritten: 0, totalCommissionPaise: 0 }

  const period = periodYearMonth(link.saleDate)
  let rowsWritten = 0
  let totalCommissionPaise = 0

  for (const line of lines) {
    const rule = pickRuleForLine(applicable, line)
    if (!rule) continue
    const commission = computeCommissionPaise(rule, line)
    if (commission <= 0) continue

    // v3 / M1 — DEEP CLONE the snapshot BEFORE write so a later mutation
    // of the live rule can never bleed back into the row.
    const snapshot: CommissionRuleSnapshot = cloneRuleSnapshot(rule)
    await tx.commissionLedger.create({
      data: {
        businessId,
        staffUserId,
        ruleId: rule.id,
        posSaleId: link.posSaleId,
        documentId: link.documentId,
        basisPaise: line.basisPaise,
        commissionPaise: commission,
        periodYearMonth: period,
        meta: {
          ruleSnapshot: snapshot,
          source: channel,
          appliedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    })
    rowsWritten += 1
    totalCommissionPaise += commission
  }

  return { rowsWritten, totalCommissionPaise }
}
