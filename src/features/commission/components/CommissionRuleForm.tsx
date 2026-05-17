/**
 * Commission #128 — Rule create / edit form.
 *
 * S2 — rate cap UX (mirrors server COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT):
 *   - rateBps < 5000               → no banner, save enabled
 *   - 5000 ≤ rateBps < 10000       → YELLOW WARN banner, save enabled
 *   - rateBps ≥ 10000              → RED BLOCK banner, SAVE DISABLED
 *   - Server-side rejection (paste exceeding 100% past the input cap) →
 *     toast keyed by `commissionRateExceedsToast`.
 *
 * Visual banner is delegated to <RateBanner>; static selects to
 * <RuleFormSelects>; form-state helpers to `rule-form.utils`. This file
 * focuses on form state + submit. Mutation handlers tolerate the
 * optimistic `{}` (Offline Rule 5).
 */

import { useState, useMemo } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  ERR_RATE_EXCEEDS,
  FLAT_MAX_PAISE,
  NAME_MAX_LEN,
  NAME_MIN_LEN,
  RATE_MAX_BPS,
} from '../commission.constants'
import { percentToBps, validateRateBps } from '../commission.utils'
import {
  useCreateCommissionRule,
  useUpdateCommissionRule,
} from '../hooks/useCommissionRules'
import type {
  CommissionRuleDTO,
  CommissionRuleInput,
} from '../commission.types'
import { RateFlatFields } from './RateFlatFields'
import { ModeAndAppliesToSelects, ScopeSelect } from './RuleFormSelects'
import { toFormState, type RuleFormState } from './rule-form.utils'
import '@/styles/components.commission.css'

interface CommissionRuleFormProps {
  rule?: CommissionRuleDTO | null
  onDone?: () => void
}

export function CommissionRuleForm({ rule, onDone }: CommissionRuleFormProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [form, setForm] = useState<RuleFormState>(() => toFormState(rule))

  const isPercentMode = form.mode === 'PERCENT_GROSS' || form.mode === 'PERCENT_NET'
  const isFlatMode = form.mode === 'FLAT_PER_UNIT'
  const rateBps = useMemo(() => percentToBps(form.ratePercent), [form.ratePercent])
  const rateValidation = useMemo(() => validateRateBps(rateBps), [rateBps])

  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.code === ERR_RATE_EXCEEDS) {
      toast.error(t.commissionRateExceedsToast)
      return
    }
    toast.error(t.commissionRuleSaveFailed)
  }

  const create = useCreateCommissionRule({
    onSuccess: () => {
      toast.success(
        navigator.onLine ? t.commissionRuleCreatedToast : t.commissionRuleQueuedToast,
      )
      onDone?.()
    },
    onError: handleError,
  })
  const update = useUpdateCommissionRule({
    onSuccess: () => {
      toast.success(
        navigator.onLine ? t.commissionRuleUpdatedToast : t.commissionRuleQueuedToast,
      )
      onDone?.()
    },
    onError: handleError,
  })

  const setField = <K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const blockSave = rateValidation.block && isPercentMode
  const isPending = create.isPending || update.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (blockSave) return

    const trimmed = form.name.trim()
    if (trimmed.length < NAME_MIN_LEN || trimmed.length > NAME_MAX_LEN) {
      toast.error(t.commissionRuleNameInvalid)
      return
    }
    if (form.scope === 'ALL' && form.scopeId.trim().length > 0) {
      toast.error(t.commissionRuleScopeMismatch)
      return
    }
    if (
      (form.scope === 'PRODUCT' || form.scope === 'CATEGORY') &&
      form.scopeId.trim().length === 0
    ) {
      toast.error(t.commissionRuleScopeRequired)
      return
    }
    if (isPercentMode && (rateBps <= 0 || rateBps > RATE_MAX_BPS)) {
      toast.error(t.commissionRateInvalid)
      return
    }

    const flatPaise = Math.round(parseFloat(form.flatPerUnitRupees || '0') * 100)
    if (isFlatMode && (flatPaise <= 0 || flatPaise > FLAT_MAX_PAISE)) {
      toast.error(t.commissionFlatInvalid)
      return
    }

    const staffUserIds = form.staffUserIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const input: CommissionRuleInput = {
      name: trimmed,
      scope: form.scope,
      scopeId: form.scope === 'ALL' ? null : form.scopeId.trim(),
      mode: form.mode,
      rateBps: isPercentMode ? rateBps : null,
      flatPerUnitPaise: isFlatMode ? flatPaise : null,
      appliesTo: form.appliesTo,
      staffUserIds,
      isActive: form.isActive,
    }

    if (rule) update.mutate({ id: rule.id, input })
    else create.mutate(input)
  }

  return (
    <form className="commission-rule-form" onSubmit={handleSubmit}>
      <Input
        label={t.commissionRuleNameLabel}
        value={form.name}
        onChange={(e) => setField('name', e.target.value)}
        maxLength={NAME_MAX_LEN}
        required
        placeholder={t.commissionRuleNamePlaceholder}
      />

      <div className="commission-rule-form__row">
        <ScopeSelect scope={form.scope} onScopeChange={(s) => setField('scope', s)} />
        {form.scope !== 'ALL' && (
          <Input
            label={
              form.scope === 'PRODUCT'
                ? t.commissionRuleProductIdLabel
                : t.commissionRuleCategoryIdLabel
            }
            value={form.scopeId}
            onChange={(e) => setField('scopeId', e.target.value)}
            placeholder={t.commissionRuleScopeIdPlaceholder}
          />
        )}
      </div>

      <div className="commission-rule-form__row">
        <ModeAndAppliesToSelects
          mode={form.mode}
          onModeChange={(m) => setField('mode', m)}
          appliesTo={form.appliesTo}
          onAppliesToChange={(a) => setField('appliesTo', a)}
        />
      </div>

      <RateFlatFields
        isPercentMode={isPercentMode}
        isFlatMode={isFlatMode}
        ratePercent={form.ratePercent}
        onRatePercentChange={(v) => setField('ratePercent', v)}
        rateBps={rateBps}
        flatPerUnitRupees={form.flatPerUnitRupees}
        onFlatPerUnitChange={(v) => setField('flatPerUnitRupees', v)}
      />

      <div>
        <Input
          label={t.commissionRuleStaffLabel}
          value={form.staffUserIds}
          onChange={(e) => setField('staffUserIds', e.target.value)}
          placeholder={t.commissionRuleStaffPlaceholder}
        />
        <p className="commission-rule-form__hint">{t.commissionRuleStaffHint}</p>
      </div>

      <div className="commission-rule-form__toggle-row">
        <span className="commission-rule-form__toggle-label">
          {t.commissionRuleActiveLabel}
        </span>
        <input
          type="checkbox"
          aria-label={t.commissionRuleActiveLabel}
          checked={form.isActive}
          onChange={(e) => setField('isActive', e.target.checked)}
          style={{ width: 20, height: 20, minHeight: 20 }}
        />
      </div>

      <div className="commission-rule-form__footer">
        <Button
          type="submit"
          variant="primary"
          loading={isPending}
          disabled={blockSave || isPending}
        >
          {isPending
            ? t.commissionRuleSaveProgress
            : rule
              ? t.commissionRuleUpdateButton
              : t.commissionRuleCreateButton}
        </Button>
      </div>
    </form>
  )
}
