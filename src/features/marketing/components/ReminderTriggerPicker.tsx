import { useLanguage } from '@/hooks/useLanguage'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
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
    <div className="flex flex-col gap-2 w-full" role="radiogroup" aria-label={t.marketingTriggerGroupAria}>
      {TRIGGERS.map((trigger) => {
        const active = value === trigger
        return (
          <Card
            key={trigger}
            clickable={!disabled}
            role="radio"
            aria-checked={active}
            onClick={() => !disabled && onChange(trigger)}
            className={cn(
              'p-3.5 flex flex-col items-start gap-0.5 text-left border rounded-xl transition-all',
              disabled && 'opacity-60 cursor-not-allowed',
              active
                ? 'border-primary ring-1 ring-primary bg-primary/5'
                : 'border-border bg-card hover:border-[var(--border-strong)]'
            )}
          >
            <span className={cn('font-semibold text-sm', active ? 'text-primary' : 'text-foreground')}>
              {t[TRIGGER_LABEL_KEYS[trigger]]}
            </span>
            <span className={cn('text-xs', active ? 'text-primary/80' : 'text-muted-foreground')}>
              {t[DESC_KEY[trigger]]}
            </span>
          </Card>
        )
      })}
    </div>
  )
}
