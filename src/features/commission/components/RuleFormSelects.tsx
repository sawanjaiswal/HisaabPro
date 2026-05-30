/**
 * Commission #128 — Rule form static select fields (scope / mode / appliesTo).
 *
 * Extracted from CommissionRuleForm to keep the parent under the 250 LOC cap.
 * Renders 3 Radix Select fields driven by the constants tables. Pure
 * presentational — caller owns state and onChange handlers.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { Select, SelectItem } from '@/components/ui/Select'
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
      <Select
        value={scope}
        onValueChange={(v) => onScopeChange(v as CommissionRuleScope)}
        ariaLabel={t.commissionRuleScopeLabel}
      >
        {SCOPE_VALUES.map((s) => (
          <SelectItem key={s} value={s}>
            {t[`commissionScope_${s}` as keyof typeof t] as string}
          </SelectItem>
        ))}
      </Select>
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
        <Select
          value={mode}
          onValueChange={(v) => onModeChange(v as CommissionRuleMode)}
          ariaLabel={t.commissionRuleModeLabel}
        >
          {MODE_VALUES.map((m) => (
            <SelectItem key={m} value={m}>
              {t[`commissionMode_${m}` as keyof typeof t] as string}
            </SelectItem>
          ))}
        </Select>
      </label>

      <label className="commission-rule-form__field">
        <span className="commission-rule-form__label">{t.commissionRuleAppliesToLabel}</span>
        <Select
          value={appliesTo}
          onValueChange={(v) => onAppliesToChange(v as CommissionAppliesTo)}
          ariaLabel={t.commissionRuleAppliesToLabel}
        >
          {APPLIES_TO_VALUES.map((a) => (
            <SelectItem key={a} value={a}>
              {t[`commissionAppliesTo_${a}` as keyof typeof t] as string}
            </SelectItem>
          ))}
        </Select>
      </label>
    </>
  )
}
