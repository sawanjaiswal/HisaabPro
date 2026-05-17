/**
 * Commission #128 — Rule form state + DTO conversion helpers.
 *
 * Extracted from CommissionRuleForm.tsx so the form component stays
 * under the 250 LOC cap. Pure functions only — no React imports.
 */

import { bpsToPercentLabel } from '../commission.utils'
import type {
  CommissionAppliesTo,
  CommissionRuleDTO,
  CommissionRuleMode,
  CommissionRuleScope,
} from '../commission.types'

export interface RuleFormState {
  name: string
  scope: CommissionRuleScope
  scopeId: string
  mode: CommissionRuleMode
  ratePercent: string
  flatPerUnitRupees: string
  appliesTo: CommissionAppliesTo
  staffUserIds: string
  isActive: boolean
}

/** Seed form state from an existing DTO, or empty defaults for create mode. */
export function toFormState(r: CommissionRuleDTO | null | undefined): RuleFormState {
  return {
    name: r?.name ?? '',
    scope: r?.scope ?? 'ALL',
    scopeId: r?.scopeId ?? '',
    mode: r?.mode ?? 'PERCENT_GROSS',
    ratePercent: r?.rateBps != null ? bpsToPercentLabel(r.rateBps) : '',
    flatPerUnitRupees:
      r?.flatPerUnitPaise != null
        ? String(Math.floor(r.flatPerUnitPaise / 100))
        : '',
    appliesTo: r?.appliesTo ?? 'BOTH',
    staffUserIds: (r?.staffUserIds ?? []).join(', '),
    isActive: r?.isActive ?? true,
  }
}
