/** ReminderRuleFormPage — create/edit reminder rule */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { BottomActionBar } from '@/components/ui/BottomActionBar'
import { useLanguage } from '@/hooks/useLanguage'
import { useReminderRuleDetail, useCreateReminderRule, useUpdateReminderRule } from '../hooks/useReminderRules'
import { useMarketingTemplateList } from '../hooks/useMarketingTemplates'
import { ReminderTriggerPicker } from '../components/ReminderTriggerPicker'
import { ChannelToggle } from '../components/ChannelToggle'
import { Select, SelectItem } from '@/components/ui/Select'
import { CHANNEL_LABEL, MARKETING_ROUTES } from '../marketing.constants'
import type { MarketingChannel, ReminderRuleTrigger } from '../marketing.types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import '../marketing.css'

const FORM_ID = 'reminder-rule-form'

function blockNumberKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
}

function FormSkeleton({ label }: { label: string }) {
  return (
    <div className="reminder-form" aria-busy="true" aria-label={label}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height="48px" borderRadius="var(--radius-md)" />
      ))}
    </div>
  )
}

export default function ReminderRuleFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isEdit = !!id

  const { rule, status: detailStatus, refetch } = useReminderRuleDetail(id ?? '')
  const createMutation = useCreateReminderRule()
  const updateMutation = useUpdateReminderRule(id ?? '', rule?.name ?? '')

  const [trigger, setTrigger] = useState<ReminderRuleTrigger>('BIRTHDAY')
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<MarketingChannel>('WHATSAPP')
  const [templateId, setTemplateId] = useState('')
  const [offsetDays, setOffsetDays] = useState(0)

  const { templates } = useMarketingTemplateList(channel)

  useEffect(() => {
    if (rule) {
      setTrigger(rule.trigger)
      setName(rule.name)
      setChannel(rule.channel)
      setTemplateId(rule.templateId)
      setOffsetDays(rule.offsetDays)
    }
  }, [rule])

  const isPending = createMutation.isPending || updateMutation.isPending
  const canSubmit = name.trim().length > 0 && templateId.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { name: name.trim(), trigger, channel, templateId, offsetDays }

    if (isEdit) {
      await updateMutation.mutateAsync(payload).catch(() => null)
      navigate(MARKETING_ROUTES.REMINDERS)
    } else {
      const created = await createMutation.mutateAsync(payload).catch(() => null)
      if (created) navigate(MARKETING_ROUTES.REMINDERS)
    }
  }

  const activeTemplates = templates.filter((tpl) => tpl.isActive)
  const offsetLabel = trigger === 'BIRTHDAY' ? t.marketingDaysBeforeBirthday :
    trigger === 'PAYMENT_DUE' ? t.marketingDaysBeforeDue :
    trigger === 'PAYMENT_OVERDUE' ? t.marketingDaysAfterDue :
    trigger === 'FOLLOWUP' ? t.marketingDaysAfterLastTxn :
    t.marketingDaysOfInactivity

  const showForm = !isEdit || (detailStatus === 'success' && !!rule)

  return (
    <AppShell>
      <Header
        title={isEdit ? t.marketingEditReminderRule : t.marketingNewReminderRule}
        backTo={MARKETING_ROUTES.REMINDERS}
      />
      <HeroPage>
        {isEdit && detailStatus === 'loading' && (
          <FormSkeleton label={t.marketingLoadingRuleAria as string} />
        )}

        {isEdit && detailStatus === 'error' && (
          <ErrorState message={t.marketingLoadRuleError} onRetry={() => void refetch()} />
        )}

        {isEdit && detailStatus === 'success' && !rule && (
          <ErrorState
            title={t.marketingRuleNotFound}
            message={t.marketingRuleNotFoundDesc}
          />
        )}

        {showForm && (
          <form id={FORM_ID} onSubmit={(e) => { void handleSubmit(e) }} className="reminder-form">
            <Input
              id="rule-name"
              label={t.marketingRuleNameLabel}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder={t.marketingRuleNamePh}
              aria-required="true"
            />

            <div className="input-group">
              <label className="input-label">{t.marketingTriggerLabel}</label>
              <ReminderTriggerPicker value={trigger} onChange={setTrigger} />
            </div>

            <Input
              id="rule-offset"
              label={offsetLabel}
              type="number"
              min={0}
              max={90}
              inputMode="numeric"
              value={offsetDays}
              onKeyDown={blockNumberKeys}
              onChange={(e) => setOffsetDays(Math.max(0, Math.min(90, parseInt(e.target.value, 10) || 0)))}
            />

            <div className="input-group">
              <label className="input-label">{t.marketingSendViaLabel}</label>
              <ChannelToggle value={channel} onChange={(ch) => { setChannel(ch); setTemplateId('') }} disabled={isEdit} />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="rule-template">{t.marketingTemplateLabel}</label>
              {activeTemplates.length === 0 ? (
                <div className="reminder-form__warning">
                  {t.marketingNoActiveChannelTpl.replace('{{channel}}', CHANNEL_LABEL[channel])}
                </div>
              ) : (
                <Select
                  value={templateId || undefined}
                  onValueChange={setTemplateId}
                  ariaLabel={t.marketingTemplateLabel}
                  placeholder={t.marketingSelectTemplatePh}
                >
                  {activeTemplates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                  ))}
                </Select>
              )}
            </div>
          </form>
        )}
      </HeroPage>

      {showForm && (
        <BottomActionBar>
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            loading={isPending}
            disabled={!canSubmit}
          >
            {isPending ? t.marketingSavingRule : t.marketingSaveRule}
          </Button>
        </BottomActionBar>
      )}
    </AppShell>
  )
}
