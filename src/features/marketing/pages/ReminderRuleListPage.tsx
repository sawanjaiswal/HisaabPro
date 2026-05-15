/** ReminderRuleListPage — /marketing/reminders */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useReminderRuleList, useDeleteReminderRule, useToggleReminderRule } from '../hooks/useReminderRules'
import { ChannelBadge } from '../components/ChannelBadge'
import { MARKETING_ROUTES, TRIGGER_BADGE } from '../marketing.constants'
import type { ReminderRule, ReminderRuleTrigger } from '../marketing.types'

const TRIGGER_LABEL_KEYS: Record<ReminderRuleTrigger, 'marketingTriggerBirthdayLabel' | 'marketingTriggerPaymentDueLabel' | 'marketingTriggerPaymentOverdueLabel' | 'marketingTriggerFollowupLabel' | 'marketingTriggerInactiveLabel'> = {
  BIRTHDAY:         'marketingTriggerBirthdayLabel',
  PAYMENT_DUE:      'marketingTriggerPaymentDueLabel',
  PAYMENT_OVERDUE:  'marketingTriggerPaymentOverdueLabel',
  FOLLOWUP:         'marketingTriggerFollowupLabel',
  INACTIVE:         'marketingTriggerInactiveLabel',
}

export default function ReminderRuleListPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { rules, status, refresh } = useReminderRuleList()
  const deleteMutation = useDeleteReminderRule()
  const toggleMutation = useToggleReminderRule()
  const [confirmDelete, setConfirmDelete] = useState<ReminderRule | null>(null)

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(MARKETING_ROUTES.HUB)} aria-label={t.marketingBackToMarketingAria}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 style={{ flex: 1, fontSize: '20px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>{t.marketingReminderRulesTitle}</h1>
        <button
          type="button"
          onClick={() => navigate(MARKETING_ROUTES.REMINDER_NEW)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
          aria-label={t.marketingReminderNewAria}
        >
          <Plus size={16} aria-hidden="true" /> {t.marketingNew}
        </button>
      </div>

      {status === 'loading' && (
        <div aria-busy="true" aria-label={t.marketingReminderLoadingAria}>
          {[0, 1, 2].map((i) => <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--color-gray-100)', marginBottom: 10, animation: 'pulse 1.5s infinite' }} />)}
        </div>
      )}

      {status === 'error' && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-error-600)', fontSize: '14px' }}>
          {t.marketingReminderLoadFailed}
          <button type="button" onClick={refresh} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--color-primary-600)', cursor: 'pointer', fontSize: '14px' }}>
            <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle' }} aria-hidden="true" /> {t.marketingRetry}
          </button>
        </div>
      )}

      {status === 'success' && rules.length === 0 && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: '8px' }}>{t.marketingNoRemindersYet}</div>
          <div style={{ fontSize: '13px', marginBottom: '20px' }}>{t.marketingNoRemindersDesc}</div>
          <button type="button" onClick={() => navigate(MARKETING_ROUTES.REMINDER_NEW)} style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
            {t.marketingCreateRule}
          </button>
        </div>
      )}

      {status === 'success' && rules.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rules.map((rule) => {
            const offsetKey = rule.offsetDays === 1 ? t.marketingOffsetDay : t.marketingOffsetDays
            const offsetText = offsetKey.replace('{{n}}', String(rule.offsetDays))
            const triggerLabel = t[TRIGGER_LABEL_KEYS[rule.trigger]]
            return (
            <div key={rule.id} style={{ padding: '14px', borderRadius: '12px', background: 'white', border: '1px solid var(--color-gray-200)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-gray-800)' }}>{rule.name}</span>
                    <span className={TRIGGER_BADGE[rule.trigger]}>{triggerLabel}</span>
                    <ChannelBadge channel={rule.channel} />
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>
                    {offsetText}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: rule.id, name: rule.name })}
                    disabled={toggleMutation.isPending}
                    aria-pressed={rule.enabled}
                    aria-label={rule.enabled ? t.marketingPauseRuleAria : t.marketingEnableRuleAria}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: '999px',
                      border: 'none',
                      background: rule.enabled ? 'var(--color-success-500)' : 'var(--color-gray-300)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '3px',
                      left: rule.enabled ? '22px' : '3px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'white',
                      transition: 'left 0.15s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => navigate(MARKETING_ROUTES.REMINDER_EDIT.replace(':id', rule.id))}
                      style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--color-gray-200)', background: 'white', cursor: 'pointer', display: 'flex' }}
                      aria-label={t.marketingEditRuleAria.replace('{{name}}', rule.name)}
                    >
                      <Pencil size={14} color="var(--color-gray-500)" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(rule)}
                      style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--color-error-200)', background: 'white', cursor: 'pointer', display: 'flex' }}
                      aria-label={t.marketingDeleteRuleAria.replace('{{name}}', rule.name)}
                    >
                      <Trash2 size={14} color="var(--color-error-500)" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="del-rule-title">
          <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: '20px 20px 0 0', padding: '24px 20px' }}>
            <h3 id="del-rule-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: '10px' }}>{t.marketingDeleteRuleTitle}</h3>
            <p style={{ fontSize: '14px', color: 'var(--color-gray-600)', marginBottom: '20px' }}>{t.marketingDeleteRuleDesc}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--color-gray-300)', background: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>{t.marketingCancel}</button>
              <button
                type="button"
                onClick={() => { deleteMutation.mutate({ id: confirmDelete.id, name: confirmDelete.name }); setConfirmDelete(null) }}
                disabled={deleteMutation.isPending}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-error-600)', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                {t.marketingDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
