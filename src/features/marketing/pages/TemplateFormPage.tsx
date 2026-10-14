/** TemplateFormPage — /marketing/templates/new and /marketing/templates/:id/edit */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { useMarketingTemplateDetail, useCreateTemplate, useUpdateTemplate } from '../hooks/useMarketingTemplates'
import { DltWarningCard } from '../components/DltWarningCard'
import { ChannelToggle } from '../components/ChannelToggle'
import { MARKETING_ROUTES } from '../marketing.constants'
import type { MarketingChannel, CreateTemplatePayload } from '../marketing.types'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'

import { Checkbox } from '@/components/ui/Checkbox'
import { Skeleton } from '@/components/ui/Skeleton'

const SMS_CHAR_WARN = 140
const SMS_CHAR_MAX = 160

export default function TemplateFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isEdit = !!id

  const { template, status: detailStatus } = useMarketingTemplateDetail(id ?? '')
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate(id ?? '', template?.name ?? '')

  const [channel, setChannel] = useState<MarketingChannel>('WHATSAPP')
  const [name, setName] = useState('')
  const [bodyEn, setBodyEn] = useState('')
  const [dltTemplateId, setDltTemplateId] = useState('')
  const [dltRegistered, setDltRegistered] = useState(false)
  const [waTemplateName, setWaTemplateName] = useState('')
  const [variables, setVariables] = useState('')

  // Populate form on edit
  useEffect(() => {
    if (template) {
      setChannel(template.channel)
      setName(template.name)
      setBodyEn(template.bodyEn)
      setDltTemplateId(template.dltTemplateId ?? '')
      setDltRegistered(template.dltRegistered)
      setWaTemplateName(template.waTemplateName ?? '')
      setVariables(template.variables.join(', '))
    }
  }, [template])

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: CreateTemplatePayload = {
      name: name.trim(),
      channel,
      bodyEn: bodyEn.trim(),
      variables: variables.split(',').map((v) => v.trim()).filter(Boolean),
      ...(channel === 'SMS' && dltTemplateId.trim() ? { dltTemplateId: dltTemplateId.trim() } : {}),
      ...(channel === 'WHATSAPP' && waTemplateName.trim() ? { waTemplateName: waTemplateName.trim() } : {}),
    }

    if (isEdit) {
      await updateMutation.mutateAsync({ ...payload, dltRegistered }).catch(() => null)
    } else {
      const created = await createMutation.mutateAsync(payload).catch(() => null)
      if (created && 'id' in created && created.id) {
        navigate(MARKETING_ROUTES.TEMPLATES)
      }
    }
  }

  const showDltWarning = channel === 'SMS' && (!dltTemplateId.trim() || !dltRegistered)
  const charCount = bodyEn.length

  const title = isEdit ? t.marketingEditTemplate : t.marketingNewTemplate

  if (isEdit && detailStatus === 'loading') {
    return (
      <AppShell header={<Header title={title} backTo={MARKETING_ROUTES.TEMPLATES} />}>
        <PageContainer className="py-4 max-w-2xl mx-auto space-y-3" aria-busy="true" aria-label={t.marketingTemplates}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell header={<Header title={title} backTo={MARKETING_ROUTES.TEMPLATES} />}>
      <PageContainer className="py-4 pb-24 max-w-2xl mx-auto">
        {/* DLT warning */}
        {showDltWarning && <DltWarningCard hasDltId={!!dltTemplateId.trim()} isRegistered={dltRegistered} />}

        <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-4">
          {/* Channel */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
              {t.marketingSendVia}
            </label>
            <div className="flex gap-2.5">
              <ChannelToggle value={channel} onChange={(ch) => { setChannel(ch); setDltTemplateId(''); setWaTemplateName('') }} disabled={isEdit} />
            </div>
            {isEdit && <div className="text-xs text-[var(--text-muted)] mt-1">{t.marketingChannelCannotChange}</div>}
          </div>

          {/* Name */}
          <div>
            <label htmlFor="tmpl-name" className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
              {t.marketingTemplateName} *
            </label>
            <Input id="tmpl-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder={t.marketingTemplateNamePh} aria-required="true" />
          </div>

          {/* Body */}
          <div>
            <label htmlFor="tmpl-body" className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
              {t.marketingMessageBody} *
              {channel === 'SMS' && (
                <span className={`float-right text-xs font-normal ${charCount > SMS_CHAR_WARN ? 'text-destructive' : 'text-[var(--text-muted)]'}`}>
                  {charCount}/{SMS_CHAR_MAX}
                </span>
              )}
            </label>
            <Textarea
              id="tmpl-body"
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              required
              maxLength={channel === 'SMS' ? SMS_CHAR_MAX : 1000}
              rows={5}
              placeholder={t.marketingMessageBodyPh}
              className="resize-y min-h-[100px]"
              aria-required="true"
              aria-describedby={channel === 'SMS' ? 'sms-char-note' : undefined}
            />
            {channel === 'SMS' && charCount > SMS_CHAR_WARN && (
              <div id="sms-char-note" className="text-xs text-amber-600 mt-1">
                {t.marketingSmsCharOver140}
              </div>
            )}
          </div>

          {/* Variables */}
          <div>
            <label htmlFor="tmpl-vars" className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
              {t.marketingVariableNames}
            </label>
            <Input id="tmpl-vars" type="text" value={variables} onChange={(e) => setVariables(e.target.value)} placeholder={t.marketingVariableNamesPh} />
            <div className="text-xs text-[var(--text-muted)] mt-1">{t.marketingVariableNamesHelper}</div>
          </div>

          {/* Channel-specific */}
          {channel === 'SMS' && (
            <>
              <div>
                <label htmlFor="tmpl-dlt" className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                  {t.marketingDltTemplateId}
                </label>
                <Input id="tmpl-dlt" type="text" value={dltTemplateId} onChange={(e) => setDltTemplateId(e.target.value)} placeholder={t.marketingDltTemplateIdPh} maxLength={60} />
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox id="dlt-reg" checked={dltRegistered} onCheckedChange={(val) => setDltRegistered(Boolean(val))} />
                <label htmlFor="dlt-reg" className="text-sm font-medium text-[var(--text-secondary)] cursor-pointer select-none">
                  {t.marketingDltRegisteredCheck}
                </label>
              </div>
            </>
          )}

          {channel === 'WHATSAPP' && (
            <div>
              <label htmlFor="tmpl-wa" className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                {t.marketingWaTemplateName}
              </label>
              <Input id="tmpl-wa" type="text" value={waTemplateName} onChange={(e) => setWaTemplateName(e.target.value)} placeholder={t.marketingWaTemplateNamePh} maxLength={80} />
              <div className="text-xs text-[var(--text-muted)] mt-1">{t.marketingWaTemplateHelper}</div>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={isPending || !name.trim() || !bodyEn.trim()}
            className="w-full mt-2"
          >
            {isPending ? t.marketingSaving : t.marketingSaveTemplate}
          </Button>
        </form>
      </PageContainer>
    </AppShell>
  )
}
