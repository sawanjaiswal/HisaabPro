/**
 * Commission #128 — Rule list (settings page primary view).
 *
 * Renders the active + (optionally) inactive rules with edit + delete
 * affordances. Delete goes through <ConfirmDialog> per Rule C — never
 * window.confirm. Each row's secondary line shows scope / mode / rate
 * derived from the DTO so the user can scan rules at a glance.
 *
 * 4 UI states (Rule G): Loading skeleton · Error retry · Empty CTA ·
 * Success list.
 */

import { useState } from 'react'
import { Pencil, Plus, Trash2, ScrollText } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatPaise } from '@/lib/format'
import {
  useCommissionRules,
  useDeleteCommissionRule,
} from '../hooks/useCommissionRules'
import { bpsToPercentLabel } from '../commission.utils'
import type { CommissionRuleDTO } from '../commission.types'
import '@/styles/components.commission.css'

interface CommissionRuleListProps {
  onCreate: () => void
  onEdit: (rule: CommissionRuleDTO) => void
}

function describeRule(rule: CommissionRuleDTO, t: ReturnType<typeof useLanguage>['t']): string {
  const scopeLabel = t[`commissionScope_${rule.scope}` as keyof typeof t] as string
  const modeLabel = t[`commissionMode_${rule.mode}` as keyof typeof t] as string
  const detail =
    rule.mode === 'FLAT_PER_UNIT' && rule.flatPerUnitPaise != null
      ? `${formatPaise(rule.flatPerUnitPaise)} ${t.commissionRuleListFlatPerUnit}`
      : rule.rateBps != null
        ? `${bpsToPercentLabel(rule.rateBps)}%`
        : '—'
  return `${scopeLabel} · ${modeLabel} · ${detail}`
}

export function CommissionRuleList({ onCreate, onEdit }: CommissionRuleListProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const { rules, isLoading, isError, refetch } = useCommissionRules({
    includeInactive: true,
  })
  const [pendingDelete, setPendingDelete] = useState<CommissionRuleDTO | null>(null)
  const del = useDeleteCommissionRule({
    onSuccess: () => {
      toast.success(
        navigator.onLine ? t.commissionRuleDeletedToast : t.commissionRuleQueuedToast,
      )
      setPendingDelete(null)
    },
    onError: () => {
      toast.error(t.commissionRuleDeleteFailed)
    },
  })

  if (isLoading) {
    return (
      <div className="commission-rule-list" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height="84px" borderRadius="var(--radius-md)" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState message={t.commissionRulesLoadFailed} onRetry={refetch} />
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText size={22} aria-hidden="true" />}
        title={t.commissionRulesEmptyTitle}
        description={t.commissionRulesEmptyDesc}
        action={
          <Button variant="primary" onClick={onCreate} aria-label={t.commissionRuleCreateButton}>
            <Plus size={16} aria-hidden="true" />
            {t.commissionRuleCreateButton}
          </Button>
        }
      />
    )
  }

  return (
    <div className="commission-rule-list">
      {rules.map((rule) => (
        <Card key={rule.id} className="commission-rule-card">
          <div className="commission-rule-card__top">
            <div className="commission-rule-card__title-block">
              <span className="commission-rule-card__name">{rule.name}</span>
              {!rule.isActive && (
                <span className="commission-rule-card__inactive">
                  {t.commissionRuleInactive}
                </span>
              )}
            </div>
            <div className="commission-rule-card__actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(rule)}
                aria-label={t.commissionRuleEdit}
              >
                <Pencil size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingDelete(rule)}
                aria-label={t.commissionRuleDelete}
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="commission-rule-card__meta">{describeRule(rule, t)}</div>
          {rule.staffUserIds.length > 0 && (
            <div className="commission-rule-card__staff">
              {t.commissionRuleStaffCount.replace(
                '{count}',
                String(rule.staffUserIds.length),
              )}
            </div>
          )}
        </Card>
      ))}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            del.mutate({ id: pendingDelete.id, label: pendingDelete.name })
          }
        }}
        title={t.commissionRuleDeleteConfirmTitle}
        description={t.commissionRuleDeleteConfirmDesc.replace(
          '{name}',
          pendingDelete?.name ?? '',
        )}
        confirmLabel={t.commissionRuleDelete}
        cancelLabel={t.commissionRuleDeleteCancel}
        isDanger
        isLoading={del.isPending}
      />
    </div>
  )
}
