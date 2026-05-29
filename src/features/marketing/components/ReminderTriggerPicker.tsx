/** ReminderTriggerPicker — trigger type selector */

import { useLanguage } from '@/hooks/useLanguage'
import { TRIGGER_LABEL_KEYS } from '../marketing.constants'
import type { ReminderRuleTrigger } from '../marketing.types'

interface Props {
  value: ReminderRuleTrigger
  onChange: (trigger: ReminderRuleTrigger) => void
  disabled?: boolean
}

const TRIGGERS: ReminderRuleTrigger[] = ['BIRTHDAY', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'FOLLOWUP', 'INACTIVE', 'ORDER_DELIVERY']

const DESC_KEY: Record<ReminderRuleTrigger, 'marketingTriggerBirthdayDesc' | 'marketingTriggerPaymentDueDesc' | 'marketingTriggerPaymentOverdueDesc' | 'marketingTriggerFollowupDesc' | 'marketingTriggerInactiveDesc' | 'marketingTriggerOrderDeliveryDesc'> = {
  BIRTHDAY:         'marketingTriggerBirthdayDesc',
  PAYMENT_DUE:      'marketingTriggerPaymentDueDesc',
  PAYMENT_OVERDUE:  'marketingTriggerPaymentOverdueDesc',
  FOLLOWUP:         'marketingTriggerFollowupDesc',
  INACTIVE:         'marketingTriggerInactiveDesc',
  ORDER_DELIVERY:   'marketingTriggerOrderDeliveryDesc',
}

export function ReminderTriggerPicker({ value, onChange, disabled = false }: Props) {
  const { t } = useLanguage()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} role="radiogroup" aria-label={t.marketingTriggerGroupAria}>
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
              {t[TRIGGER_LABEL_KEYS[trigger]]}
            </span>
            <span style={{ fontSize: '12px', color: active ? 'var(--color-primary-600)' : 'var(--color-gray-400)' }}>
              {t[DESC_KEY[trigger]]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
