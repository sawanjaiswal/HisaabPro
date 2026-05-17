/**
 * Commission #128 — v3 / M1 deep-clone snapshot utils.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §4.2 (callout box).
 *
 * Single SSOT for the `JSON.parse(JSON.stringify(...))` idiom so every
 * call site is mechanically identical. Two flavours:
 *
 *  - `cloneRuleSnapshot(rule)` → freezes the live CommissionRule into the
 *    forensic-shape that's written to `CommissionLedger.meta.ruleSnapshot`
 *    on FORWARD accrual.
 *  - `cloneFromPriorMeta(meta)` → re-snapshots an existing ledger row's
 *    `meta.ruleSnapshot` for VOID / RESTORE rows so the audit chain stays
 *    intact even if the live rule was edited or soft-deleted between
 *    accrual and reversal.
 *
 * §17.3 grep test: `git grep -n "JSON.parse(JSON.stringify"
 *  server/src/services/commission/` MUST return ≥ 2 matches (one for
 * forward accrual, one for void/restore re-snapshot from prior
 * meta.ruleSnapshot). Both live below.
 */

import type { CommissionRuleDTO } from './commission-rule.service.js'

/** Shape of the frozen snapshot embedded in `CommissionLedger.meta.ruleSnapshot`. */
export interface CommissionRuleSnapshot {
  ruleId: string
  name: string
  scope: string
  scopeId: string | null
  mode: string
  rateBps: number | null
  flatPerUnitPaise: number | null
  appliesTo: string
  createdAt: string  // ISO
  snapshotAt: string // ISO
}

/**
 * Forward-accrual deep clone. Called from inside the POS / Document
 * `$transaction` immediately BEFORE `tx.commissionLedger.create`.
 *
 * The `JSON.parse(JSON.stringify(...))` idiom strips Date → ISO string
 * and severs every reference to the live rule. Cost: ~50 µs/row.
 */
export function cloneRuleSnapshot(rule: CommissionRuleDTO): CommissionRuleSnapshot {
  // v3 / M1 — DEEP CLONE forward accrual site.
  return JSON.parse(JSON.stringify({
    ruleId: rule.id,
    name: rule.name,
    scope: rule.scope,
    scopeId: rule.scopeId,
    mode: rule.mode,
    rateBps: rule.rateBps,
    flatPerUnitPaise: rule.flatPerUnitPaise,
    appliesTo: rule.appliesTo,
    createdAt: rule.createdAt.toISOString(),
    snapshotAt: new Date().toISOString(),
  })) as CommissionRuleSnapshot
}

/**
 * Void / restore re-snapshot. Pulls the frozen `ruleSnapshot` from a
 * prior ledger row's `meta` (NOT the live rule — which may have been
 * edited or soft-deleted) and produces a fresh deep clone for the new
 * VOID / RESTORE row.
 *
 * Returns `null` if the prior meta does not carry a usable snapshot
 * (defensive — pre-v3 rows from a manual SQL backfill might be bare).
 */
export function cloneFromPriorMeta(meta: unknown): CommissionRuleSnapshot | null {
  if (!meta || typeof meta !== 'object') return null
  const m = meta as { ruleSnapshot?: unknown }
  if (!m.ruleSnapshot || typeof m.ruleSnapshot !== 'object') return null
  // v3 / M1 — DEEP CLONE void/restore re-snapshot site.
  return JSON.parse(JSON.stringify(m.ruleSnapshot)) as CommissionRuleSnapshot
}
