/** TemplateListPage — /marketing/templates */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { useMarketingTemplateList, useDeleteTemplate } from '../hooks/useMarketingTemplates'
import { ChannelBadge } from '../components/ChannelBadge'
import { MARKETING_ROUTES } from '../marketing.constants'
import { formatDate } from '../marketing.utils'
import type { MarketingChannel, MarketingTemplate } from '../marketing.types'

const CHANNEL_FILTERS: Array<{ label: string; value: MarketingChannel | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'WhatsApp', value: 'WHATSAPP' },
  { label: 'SMS', value: 'SMS' },
]

export default function TemplateListPage() {
  const navigate = useNavigate()
  const [channel, setChannel] = useState<MarketingChannel | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<MarketingTemplate | null>(null)
  const { templates, status, refresh } = useMarketingTemplateList(channel)
  const deleteMutation = useDeleteTemplate()

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(MARKETING_ROUTES.HUB)} aria-label="Back to Marketing">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 style={{ flex: 1, fontSize: '20px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>Templates</h1>
        <button
          type="button"
          onClick={() => navigate(MARKETING_ROUTES.TEMPLATE_NEW)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
          aria-label="New Template"
        >
          <Plus size={16} aria-hidden="true" /> New
        </button>
      </div>

      {/* Channel filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {CHANNEL_FILTERS.map((f) => (
          <button
            key={String(f.value)}
            type="button"
            onClick={() => setChannel(f.value)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              border: `1px solid ${channel === f.value ? 'var(--color-primary-600)' : 'var(--color-gray-300)'}`,
              background: channel === f.value ? 'var(--color-primary-600)' : 'white',
              color: channel === f.value ? 'white' : 'var(--color-gray-600)',
              fontWeight: channel === f.value ? 700 : 400,
              fontSize: '13px',
              cursor: 'pointer',
            }}
            aria-pressed={channel === f.value}
          >
            {f.label}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div aria-busy="true" aria-label="Loading templates">
          {[0, 1, 2].map((i) => <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--color-gray-100)', marginBottom: 10, animation: 'pulse 1.5s infinite' }} />)}
        </div>
      )}

      {status === 'error' && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-error-600)', fontSize: '14px' }}>
          Could not load templates.
          <button type="button" onClick={refresh} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--color-primary-600)', cursor: 'pointer', fontSize: '14px' }}>
            <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle' }} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {status === 'success' && templates.length === 0 && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: '8px' }}>No templates yet</div>
          <button type="button" onClick={() => navigate(MARKETING_ROUTES.TEMPLATE_NEW)} style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
            New Template
          </button>
        </div>
      )}

      {status === 'success' && templates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {templates.map((t) => (
            <div
              key={t.id}
              style={{ padding: '14px', borderRadius: '12px', background: 'white', border: '1px solid var(--color-gray-200)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-gray-800)' }}>{t.name}</span>
                    <ChannelBadge channel={t.channel} />
                    {!t.isActive && <span className="badge badge--neutral">Inactive</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-gray-500)', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.bodyEn}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-gray-400)', marginTop: '4px' }}>{formatDate(t.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => navigate(MARKETING_ROUTES.TEMPLATE_EDIT.replace(':id', t.id))}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--color-gray-200)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    aria-label={`Edit ${t.name}`}
                  >
                    <Pencil size={15} color="var(--color-gray-500)" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(t)}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--color-error-200)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 size={15} color="var(--color-error-500)" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="del-tmpl-title">
          <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: '20px 20px 0 0', padding: '24px 20px' }}>
            <h3 id="del-tmpl-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: '10px' }}>Delete this template?</h3>
            <p style={{ fontSize: '14px', color: 'var(--color-gray-600)', marginBottom: '20px' }}>Campaigns using it cannot be re-launched.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--color-gray-300)', background: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
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
