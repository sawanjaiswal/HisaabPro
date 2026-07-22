/** ReminderRuleCard — a single reminder rule row in the list */

import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { useLanguage } from '@/hooks/useLanguage'
import { ChannelBadge } from './ChannelBadge'
import { TRIGGER_BADGE, TRIGGER_LABEL_KEYS } from '../marketing.constants'
import type { ReminderRule } from '../marketing.types'

interface ReminderRuleCardProps {
  rule: ReminderRule
  toggling: boolean
  onToggle: (rule: ReminderRule) => void
  onEdit: (rule: ReminderRule) => void
  onDelete: (rule: ReminderRule) => void
}

export function ReminderRuleCard({ rule, toggling, onToggle, onEdit, onDelete }: ReminderRuleCardProps) {
  const { t } = useLanguage()
  const offsetKey = rule.offsetDays === 1 ? t.marketingOffsetDay : t.marketingOffsetDays
  const offsetText = offsetKey.replace('{{n}}', String(rule.offsetDays))
  const triggerLabel = t[TRIGGER_LABEL_KEYS[rule.trigger]]

  return (
    <Card className="reminder-card">
      <div className="reminder-card__main">
        <div className="reminder-card__head">
          <span className="reminder-card__name">{rule.name}</span>
          <span className={TRIGGER_BADGE[rule.trigger]}>{triggerLabel}</span>
          <ChannelBadge channel={rule.channel} />
        </div>
        <div className="reminder-card__offset">{offsetText}</div>
      </div>

      <div className="reminder-card__actions">
        <Switch
          checked={rule.enabled}
          onCheckedChange={() => onToggle(rule)}
          disabled={toggling}
          ariaLabel={rule.enabled ? t.marketingPauseRuleAria : t.marketingEnableRuleAria}
        />
        <div className="reminder-card__btns">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onEdit(rule)}
            aria-label={t.marketingEditRuleAria.replace('{{name}}', rule.name)}
          >
            <Pencil size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onDelete(rule)}
            aria-label={t.marketingDeleteRuleAria.replace('{{name}}', rule.name)}
          >
            <Trash2 size={16} color="var(--color-error-500)" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
