/**
 * Commission #128 — Rule form static select fields (scope / mode / appliesTo).
 *
 * Extracted from CommissionRuleForm to keep the parent under the 250 LOC cap.
 * Renders 3 native <select> elements driven by the constants tables. Pure
 * presentational — caller owns state and onChange handlers.
 */

import { useLanguage } from '@/hooks/useLanguage'
import {
  APPLIES_TO_VALUES,
  MODE_VALUES,
  SCOPE_VALUES,
} from '../commission.constants'
import type {
  CommissionAppliesTo,
  CommissionRuleMode,
  CommissionRuleScope,
} from '../commission.types'

interface RuleFormSelectsProps {
  scope: CommissionRuleScope
  onScopeChange: (s: CommissionRuleScope) => void
  mode: CommissionRuleMode
  onModeChange: (m: CommissionRuleMode) => void
  appliesTo: CommissionAppliesTo
  onAppliesToChange: (a: CommissionAppliesTo) => void
}

export function ScopeSelect({
  scope,
  onScopeChange,
}: Pick<RuleFormSelectsProps, 'scope' | 'onScopeChange'>) {
  const { t } = useLanguage()
  return (
    <label className="commission-rule-form__field">
      <span className="commission-rule-form__label">{t.commissionRuleScopeLabel}</span>
      <select
        className="commission-rule-form__select"
        value={scope}
        onChange={(e) => onScopeChange(e.target.value as CommissionRuleScope)}
        aria-label={t.commissionRuleScopeLabel}
      >
        {SCOPE_VALUES.map((s) => (
          <option key={s} value={s}>
            {t[`commissionScope_${s}` as keyof typeof t] as string}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ModeAndAppliesToSelects({
  mode,
  onModeChange,
  appliesTo,
  onAppliesToChange,
}: Pick<
  RuleFormSelectsProps,
  'mode' | 'onModeChange' | 'appliesTo' | 'onAppliesToChange'
>) {
  const { t } = useLanguage()
  return (
    <>
      <label className="commission-rule-form__field">
        <span className="commission-rule-form__label">{t.commissionRuleModeLabel}</span>
        <select
          className="commission-rule-form__select"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as CommissionRuleMode)}
          aria-label={t.commissionRuleModeLabel}
        >
          {MODE_VALUES.map((m) => (
            <option key={m} value={m}>
              {t[`commissionMode_${m}` as keyof typeof t] as string}
            </option>
          ))}
        </select>
      </label>

      <label className="commission-rule-form__field">
        <span className="commission-rule-form__label">{t.commissionRuleAppliesToLabel}</span>
        <select
          className="commission-rule-form__select"
          value={appliesTo}
          onChange={(e) => onAppliesToChange(e.target.value as CommissionAppliesTo)}
          aria-label={t.commissionRuleAppliesToLabel}
        >
          {APPLIES_TO_VALUES.map((a) => (
            <option key={a} value={a}>
              {t[`commissionAppliesTo_${a}` as keyof typeof t] as string}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
