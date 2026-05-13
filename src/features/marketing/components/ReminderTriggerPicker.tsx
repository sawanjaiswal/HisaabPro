/** ReminderTriggerPicker — trigger type selector */

import type { ReminderRuleTrigger } from '../marketing.types'
import { TRIGGER_LABEL } from '../marketing.constants'

interface Props {
  value: ReminderRuleTrigger
  onChange: (trigger: ReminderRuleTrigger) => void
  disabled?: boolean
}

const TRIGGERS: ReminderRuleTrigger[] = ['BIRTHDAY', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'FOLLOWUP', 'INACTIVE']

const TRIGGER_DESCRIPTION: Record<ReminderRuleTrigger, string> = {
  BIRTHDAY:         'Send a wish on the customer\'s birthday',
  PAYMENT_DUE:      'Remind before invoice due date',
  PAYMENT_OVERDUE:  'Follow up after invoice due date passes unpaid',
  FOLLOWUP:         'Send a follow-up X days after the last transaction',
  INACTIVE:         'Re-engage customers inactive for X days',
}

export function ReminderTriggerPicker({ value, onChange, disabled = false }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} role="radiogroup" aria-label="Reminder trigger type">
      {TRIGGERS.map((trigger) => {
        const active = value === trigger
        return (
          <button
            key={trigger}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !disabled && onChange(trigger)}
            disabled={disabled}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '2px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `2px solid ${active ? 'var(--color-primary-500)' : 'var(--color-gray-200)'}`,
              background: active ? 'var(--color-primary-50)' : 'white',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '14px', color: active ? 'var(--color-primary-700)' : 'var(--color-gray-800)' }}>
              {TRIGGER_LABEL[trigger]}
            </span>
            <span style={{ fontSize: '12px', color: active ? 'var(--color-primary-600)' : 'var(--color-gray-400)' }}>
              {TRIGGER_DESCRIPTION[trigger]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
