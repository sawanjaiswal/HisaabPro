/** ReminderRuleFormPage — create/edit reminder rule */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useReminderRuleDetail, useCreateReminderRule, useUpdateReminderRule } from '../hooks/useReminderRules'
import { useMarketingTemplateList } from '../hooks/useMarketingTemplates'
import { ReminderTriggerPicker } from '../components/ReminderTriggerPicker'
import { ChannelToggle } from '../components/ChannelToggle'
import { CHANNEL_LABEL } from '../marketing.constants'
import { MARKETING_ROUTES } from '../marketing.constants'
import type { MarketingChannel, ReminderRuleTrigger } from '../marketing.types'

export default function ReminderRuleFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isEdit = !!id

  const { rule, status: detailStatus } = useReminderRuleDetail(id ?? '')
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

  if (isEdit && detailStatus === 'loading') {
    return (
      <div className="page-container" style={{ padding: '16px' }} aria-busy="true" aria-label={t.marketingLoadingRuleAria}>
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--color-gray-100)', marginBottom: 12, animation: 'pulse 1.5s infinite' }} />)}
      </div>
    )
  }

  const activeTemplates = templates.filter((tpl) => tpl.isActive)
  const offsetLabel = trigger === 'BIRTHDAY' ? t.marketingDaysBeforeBirthday :
    trigger === 'PAYMENT_DUE' ? t.marketingDaysBeforeDue :
    trigger === 'PAYMENT_OVERDUE' ? t.marketingDaysAfterDue :
    trigger === 'FOLLOWUP' ? t.marketingDaysAfterLastTxn :
    t.marketingDaysOfInactivity

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(MARKETING_ROUTES.REMINDERS)} aria-label={t.marketingBackToRemindersAria}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>
          {isEdit ? t.marketingEditReminderRule : t.marketingNewReminderRule}
        </h1>
      </div>

      <form onSubmit={(e) => { void handleSubmit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Name */}
        <div>
          <label htmlFor="rule-name" style={labelStyle}>{t.marketingRuleNameLabel}</label>
          <input
            id="rule-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder={t.marketingRuleNamePh}
            style={inputStyle}
            aria-required="true"
          />
        </div>

        {/* Trigger */}
        <div>
          <p style={labelStyle}>{t.marketingTriggerLabel}</p>
          <ReminderTriggerPicker value={trigger} onChange={setTrigger} />
        </div>

        {/* Offset days */}
        <div>
          <label htmlFor="rule-offset" style={labelStyle}>
            {offsetLabel}
          </label>
          <input
            id="rule-offset"
            type="number"
            min={0}
            max={90}
            value={offsetDays}
            onChange={(e) => setOffsetDays(Math.max(0, Math.min(90, parseInt(e.target.value, 10) || 0)))}
            style={{ ...inputStyle, maxWidth: '120px' }}
          />
        </div>

        {/* Channel */}
        <div>
          <p style={labelStyle}>{t.marketingSendViaLabel}</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <ChannelToggle value={channel} onChange={(ch) => { setChannel(ch); setTemplateId('') }} disabled={isEdit} />
          </div>
        </div>

        {/* Template */}
        <div>
          <label htmlFor="rule-template" style={labelStyle}>{t.marketingTemplateLabel}</label>
          {activeTemplates.length === 0 ? (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-warning-50)', border: '1px solid var(--color-warning-200)', fontSize: '13px', color: 'var(--color-warning-700)' }}>
              {t.marketingNoActiveChannelTpl.replace('{{channel}}', CHANNEL_LABEL[channel])}
            </div>
          ) : (
            <select
              id="rule-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
              style={{ ...inputStyle, appearance: 'auto' }}
              aria-required="true"
            >
              <option value="">{t.marketingSelectTemplatePh}</option>
              {activeTemplates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
            </select>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending || !canSubmit}
          style={{
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: (isPending || !canSubmit) ? 'var(--color-gray-300)' : 'var(--color-primary-600)',
            color: 'white',
            fontWeight: 700,
            fontSize: '15px',
            cursor: (isPending || !canSubmit) ? 'not-allowed' : 'pointer',
            marginTop: '8px',
          }}
        >
          {isPending ? t.marketingSavingRule : t.marketingSaveRule}
        </button>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-gray-700)',
  marginBottom: '8px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: '10px',
  border: '1px solid var(--color-gray-300)',
  fontSize: '14px',
  color: 'var(--color-gray-800)',
  background: 'white',
  boxSizing: 'border-box',
}
