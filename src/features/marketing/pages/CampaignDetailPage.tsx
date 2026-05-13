/** CampaignDetailPage — /marketing/campaigns/:id — detail + cancel */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useCampaignDetail, useCancelCampaign } from '../hooks/useCampaigns'
import { CampaignStatusBadge } from '../components/CampaignStatusBadge'
import { ChannelBadge } from '../components/ChannelBadge'
import { RecipientTable } from '../components/RecipientTable'
import { MARKETING_ROUTES } from '../marketing.constants'
import { formatDate, formatPaiseAsRupees, formatScheduledAt } from '../marketing.utils'

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ flex: '1 1 80px', minWidth: 0, padding: '14px', borderRadius: '10px', background: 'white', border: '1px solid var(--color-gray-200)', textAlign: 'center' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: color ?? 'var(--color-gray-900)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-gray-500)', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { campaign, status, refresh } = useCampaignDetail(id ?? '')
  const cancelMutation = useCancelCampaign()
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (!id) return null

  if (status === 'loading') {
    return (
      <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)' }} aria-busy="true" aria-label="Loading campaign">
        <div style={{ height: 48, borderRadius: 10, background: 'var(--color-gray-100)', marginBottom: 16, animation: 'pulse 1.5s infinite' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 80, borderRadius: 10, background: 'var(--color-gray-100)', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      </div>
    )
  }

  if (status === 'error' || !campaign) {
    return (
      <div className="page-container" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-error-600)', fontSize: '14px' }}>
        <div>Could not load campaign details.</div>
        <button type="button" onClick={refresh} style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-error-300)', background: 'white', color: 'var(--color-error-600)', cursor: 'pointer', fontSize: '14px' }}>
          <RefreshCw size={14} aria-hidden="true" /> Retry
        </button>
      </div>
    )
  }

  const canCancel = campaign.status === 'SCHEDULED' || campaign.status === 'RUNNING'

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(MARKETING_ROUTES.CAMPAIGNS)} aria-label="Back to Campaigns">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.name}</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            <ChannelBadge channel={campaign.channel} />
            <CampaignStatusBadge status={campaign.status} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Stat label="Recipients" value={campaign.recipientCount.toLocaleString('en-IN')} />
        <Stat label="Sent" value={campaign.sentCount.toLocaleString('en-IN')} color="var(--color-success-600)" />
        <Stat label="Delivered" value={campaign.deliveredCount.toLocaleString('en-IN')} />
        <Stat label="Failed" value={campaign.failedCount.toLocaleString('en-IN')} color={campaign.failedCount > 0 ? 'var(--color-error-600)' : undefined} />
      </div>

      {/* Meta */}
      <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <Row label="Schedule" value={formatScheduledAt(campaign.scheduledAt)} />
          <Row label="Cost" value={campaign.totalCostPaise > 0 ? formatPaiseAsRupees(campaign.totalCostPaise) : '—'} />
          <Row label="Created" value={formatDate(campaign.createdAt)} />
        </div>
      </div>

      {/* Recipients */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: '10px' }}>Recipients</h2>
        <RecipientTable campaignId={campaign.id} />
      </div>

      {/* Cancel */}
      {canCancel && (
        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          style={{ display: 'block', width: '100%', padding: '13px', borderRadius: '10px', border: '1px solid var(--color-error-300)', background: 'white', color: 'var(--color-error-600)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
        >
          Cancel Campaign
        </button>
      )}

      {/* Confirm cancel dialog */}
      {confirmCancel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
          <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: '20px 20px 0 0', padding: '24px 20px' }}>
            <h3 id="cancel-dialog-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: '10px' }}>Cancel this campaign?</h3>
            <p style={{ fontSize: '14px', color: 'var(--color-gray-600)', marginBottom: '20px' }}>Messages already sent will not be recalled.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setConfirmCancel(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--color-gray-300)', background: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                Keep Running
              </button>
              <button
                type="button"
                onClick={() => { setConfirmCancel(false); cancelMutation.mutate({ id: campaign.id, name: campaign.name }) }}
                disabled={cancelMutation.isPending}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-error-600)', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'var(--color-gray-500)' }}>{label}</span>
      <span style={{ color: 'var(--color-gray-800)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
