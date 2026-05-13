/** CampaignListPage — /marketing/campaigns — list with status filter */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react'
import { useCampaignList } from '../hooks/useCampaigns'
import { CampaignStatusBadge } from '../components/CampaignStatusBadge'
import { ChannelBadge } from '../components/ChannelBadge'
import { MARKETING_ROUTES } from '../marketing.constants'
import { formatDate, formatPaiseAsRupees } from '../marketing.utils'
import type { CampaignStatus } from '../marketing.types'

const STATUS_FILTERS: Array<{ label: string; value: CampaignStatus | '' }> = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Running', value: 'RUNNING' },
  { label: 'Completed', value: 'COMPLETED' },
]

function CampaignSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading campaigns">
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--color-gray-100)', marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )
}

export default function CampaignListPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('')
  const { campaigns, status, refresh } = useCampaignList(statusFilter)

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(MARKETING_ROUTES.HUB)} aria-label="Back to Marketing">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 style={{ flex: 1, fontSize: '20px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>Campaigns</h1>
        <button
          type="button"
          onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_NEW)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
          aria-label="New Campaign"
        >
          <Plus size={16} aria-hidden="true" /> New
        </button>
      </div>

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px' }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              border: `1px solid ${statusFilter === f.value ? 'var(--color-primary-600)' : 'var(--color-gray-300)'}`,
              background: statusFilter === f.value ? 'var(--color-primary-600)' : 'white',
              color: statusFilter === f.value ? 'white' : 'var(--color-gray-600)',
              fontWeight: statusFilter === f.value ? 700 : 400,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            aria-pressed={statusFilter === f.value}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {status === 'loading' && <CampaignSkeleton />}

      {/* Error */}
      {status === 'error' && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-error-600)', fontSize: '14px' }}>
          <div>Could not load campaigns. Tap to retry.</div>
          <button type="button" onClick={refresh} style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-error-300)', background: 'white', color: 'var(--color-error-600)', cursor: 'pointer', fontSize: '14px' }}>
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {status === 'success' && campaigns.length === 0 && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-gray-300)" strokeWidth="1.5" style={{ margin: '0 auto', display: 'block' }} aria-hidden="true">
              <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
            </svg>
          </div>
          <div style={{ fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: '8px' }}>No campaigns yet</div>
          <div style={{ fontSize: '13px', marginBottom: '20px' }}>Create your first campaign to reach your customers</div>
          <button type="button" onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_NEW)} style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
            Create your first campaign
          </button>
        </div>
      )}

      {/* List */}
      {status === 'success' && campaigns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_DETAIL.replace(':id', c.id))}
              style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', borderRadius: '12px', background: 'white', border: '1px solid var(--color-gray-200)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ flex: 1, fontWeight: 600, fontSize: '15px', color: 'var(--color-gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <ChannelBadge channel={c.channel} />
                <CampaignStatusBadge status={c.status} />
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-gray-500)' }}>
                <span>Sent: {c.sentCount.toLocaleString('en-IN')}</span>
                {c.failedCount > 0 && <span style={{ color: 'var(--color-error-600)' }}>Failed: {c.failedCount.toLocaleString('en-IN')}</span>}
                {c.totalCostPaise > 0 && <span>Cost: {formatPaiseAsRupees(c.totalCostPaise)}</span>}
                <span style={{ marginLeft: 'auto' }}>{formatDate(c.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
