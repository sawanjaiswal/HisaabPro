/** TemplateFormPage — /marketing/templates/new and /marketing/templates/:id/edit */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMarketingTemplateDetail, useCreateTemplate, useUpdateTemplate } from '../hooks/useMarketingTemplates'
import { DltWarningCard } from '../components/DltWarningCard'
import { ChannelToggle } from '../components/ChannelToggle'
import { MARKETING_ROUTES } from '../marketing.constants'
import type { MarketingChannel, CreateTemplatePayload } from '../marketing.types'

const SMS_CHAR_WARN = 140
const SMS_CHAR_MAX = 160

export default function TemplateFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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

  if (isEdit && detailStatus === 'loading') {
    return (
      <div className="page-container" style={{ padding: '16px' }} aria-busy="true" aria-label="Loading template">
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--color-gray-100)', marginBottom: 12, animation: 'pulse 1.5s infinite' }} />)}
      </div>
    )
  }

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(MARKETING_ROUTES.TEMPLATES)} aria-label="Back to Templates">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>
          {isEdit ? 'Edit Template' : 'New Template'}
        </h1>
      </div>

      {/* DLT warning */}
      {showDltWarning && <DltWarningCard hasDltId={!!dltTemplateId.trim()} isRegistered={dltRegistered} />}

      <form onSubmit={(e) => { void handleSubmit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Channel */}
        <div>
          <p style={labelStyle}>Send via</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <ChannelToggle value={channel} onChange={(ch) => { setChannel(ch); setDltTemplateId(''); setWaTemplateName('') }} disabled={isEdit} />
          </div>
          {isEdit && <div style={{ fontSize: '12px', color: 'var(--color-gray-400)', marginTop: '4px' }}>Channel cannot be changed after creation</div>}
        </div>

        {/* Name */}
        <div>
          <label htmlFor="tmpl-name" style={labelStyle}>Template Name *</label>
          <input id="tmpl-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="e.g. Diwali Offer" style={inputStyle} aria-required="true" />
        </div>

        {/* Body */}
        <div>
          <label htmlFor="tmpl-body" style={labelStyle}>
            Message Body *
            {channel === 'SMS' && (
              <span style={{ float: 'right', fontSize: '12px', fontWeight: 400, color: charCount > SMS_CHAR_WARN ? 'var(--color-error-600)' : 'var(--color-gray-400)' }}>
                {charCount}/{SMS_CHAR_MAX}
              </span>
            )}
          </label>
          <textarea
            id="tmpl-body"
            value={bodyEn}
            onChange={(e) => setBodyEn(e.target.value)}
            required
            maxLength={channel === 'SMS' ? SMS_CHAR_MAX : 1000}
            rows={5}
            placeholder="Dear {{customerName}}, ..."
            style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }}
            aria-required="true"
            aria-describedby={channel === 'SMS' ? 'sms-char-note' : undefined}
          />
          {channel === 'SMS' && charCount > SMS_CHAR_WARN && (
            <div id="sms-char-note" style={{ fontSize: '12px', color: 'var(--color-warning-600)', marginTop: '4px' }}>
              SMS over {SMS_CHAR_WARN} chars may split into 2 messages.
            </div>
          )}
        </div>

        {/* Variables */}
        <div>
          <label htmlFor="tmpl-vars" style={labelStyle}>Variable Names (comma separated)</label>
          <input id="tmpl-vars" type="text" value={variables} onChange={(e) => setVariables(e.target.value)} placeholder="customerName, amount, dueDate" style={inputStyle} />
          <div style={{ fontSize: '12px', color: 'var(--color-gray-400)', marginTop: '4px' }}>Use {'{{variableName}}'} in your message body</div>
        </div>

        {/* Channel-specific */}
        {channel === 'SMS' && (
          <>
            <div>
              <label htmlFor="tmpl-dlt" style={labelStyle}>DLT Template ID</label>
              <input id="tmpl-dlt" type="text" value={dltTemplateId} onChange={(e) => setDltTemplateId(e.target.value)} placeholder="Registered DLT Template ID" maxLength={60} style={inputStyle} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-gray-700)' }}>
              <input type="checkbox" checked={dltRegistered} onChange={(e) => setDltRegistered(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-600)' }} />
              DLT Registration confirmed with TRAI
            </label>
          </>
        )}

        {channel === 'WHATSAPP' && (
          <div>
            <label htmlFor="tmpl-wa" style={labelStyle}>WhatsApp Template Name (from Meta)</label>
            <input id="tmpl-wa" type="text" value={waTemplateName} onChange={(e) => setWaTemplateName(e.target.value)} placeholder="e.g. diwali_offer_2026" maxLength={80} style={inputStyle} />
            <div style={{ fontSize: '12px', color: 'var(--color-gray-400)', marginTop: '4px' }}>Must match exactly the approved name in your Meta Business Manager</div>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !name.trim() || !bodyEn.trim()}
          style={{
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: (isPending || !name.trim() || !bodyEn.trim()) ? 'var(--color-gray-300)' : 'var(--color-primary-600)',
            color: 'white',
            fontWeight: 700,
            fontSize: '15px',
            cursor: (isPending || !name.trim() || !bodyEn.trim()) ? 'not-allowed' : 'pointer',
            marginTop: '8px',
          }}
        >
          {isPending ? 'Saving...' : 'Save Template'}
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
