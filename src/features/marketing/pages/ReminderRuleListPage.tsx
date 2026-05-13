/** ReminderRuleListPage — /marketing/reminders */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { useReminderRuleList, useDeleteReminderRule, useToggleReminderRule } from '../hooks/useReminderRules'
import { ChannelBadge } from '../components/ChannelBadge'
import { MARKETING_ROUTES, TRIGGER_LABEL, TRIGGER_BADGE } from '../marketing.constants'
import type { ReminderRule } from '../marketing.types'

export default function ReminderRuleListPage() {
  const navigate = useNavigate()
  const { rules, status, refresh } = useReminderRuleList()
  const deleteMutation = useDeleteReminderRule()
  const toggleMutation = useToggleReminderRule()
  const [confirmDelete, setConfirmDelete] = useState<ReminderRule | null>(null)

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(MARKETING_ROUTES.HUB)} aria-label="Back to Marketing">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 style={{ flex: 1, fontSize: '20px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>Reminder Rules</h1>
        <button
          type="button"
          onClick={() => navigate(MARKETING_ROUTES.REMINDER_NEW)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
          aria-label="New Reminder Rule"
        >
          <Plus size={16} aria-hidden="true" /> New
        </button>
      </div>

      {status === 'loading' && (
        <div aria-busy="true" aria-label="Loading reminder rules">
          {[0, 1, 2].map((i) => <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--color-gray-100)', marginBottom: 10, animation: 'pulse 1.5s infinite' }} />)}
        </div>
      )}

      {status === 'error' && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-error-600)', fontSize: '14px' }}>
          Could not load rules.
          <button type="button" onClick={refresh} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--color-primary-600)', cursor: 'pointer', fontSize: '14px' }}>
            <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle' }} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {status === 'success' && rules.length === 0 && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: '8px' }}>No reminder rules</div>
          <div style={{ fontSize: '13px', marginBottom: '20px' }}>Set up automatic follow-ups for birthdays, payments and more</div>
          <button type="button" onClick={() => navigate(MARKETING_ROUTES.REMINDER_NEW)} style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
            Create rule
          </button>
        </div>
      )}

      {status === 'success' && rules.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rules.map((rule) => (
            <div key={rule.id} style={{ padding: '14px', borderRadius: '12px', background: 'white', border: '1px solid var(--color-gray-200)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-gray-800)' }}>{rule.name}</span>
                    <span className={TRIGGER_BADGE[rule.trigger]}>{TRIGGER_LABEL[rule.trigger]}</span>
                    <ChannelBadge channel={rule.channel} />
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>
                    Offset: {rule.offsetDays} day{rule.offsetDays !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: rule.id, name: rule.name })}
                    disabled={toggleMutation.isPending}
                    aria-pressed={rule.enabled}
                    aria-label={rule.enabled ? 'Pause rule' : 'Enable rule'}
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
                      aria-label={`Edit ${rule.name}`}
                    >
                      <Pencil size={14} color="var(--color-gray-500)" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(rule)}
                      style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--color-error-200)', background: 'white', cursor: 'pointer', display: 'flex' }}
                      aria-label={`Delete ${rule.name}`}
                    >
                      <Trash2 size={14} color="var(--color-error-500)" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="del-rule-title">
          <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: '20px 20px 0 0', padding: '24px 20px' }}>
            <h3 id="del-rule-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: '10px' }}>Delete this reminder rule?</h3>
            <p style={{ fontSize: '14px', color: 'var(--color-gray-600)', marginBottom: '20px' }}>Scheduled reminders will be cancelled.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--color-gray-300)', background: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button
                type="button"
                onClick={() => { deleteMutation.mutate({ id: confirmDelete.id, name: confirmDelete.name }); setConfirmDelete(null) }}
                disabled={deleteMutation.isPending}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-error-600)', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
