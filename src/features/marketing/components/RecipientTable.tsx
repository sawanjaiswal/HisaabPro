/** RecipientTable — paginated per-recipient dispatch status */

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/hooks/useLanguage'
import { listCampaignRecipients } from '../marketing.service'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'
import { formatPaiseAsRupees } from '../marketing.utils'

interface Props {
  campaignId: string
}

export function RecipientTable({ campaignId }: Props) {
  const { t } = useLanguage()
  const [cursor, setCursor] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['marketing', 'recipients', campaignId, cursor],
    queryFn: ({ signal }) => listCampaignRecipients(campaignId, cursor, signal),
    enabled: !!campaignId,
  })

  const handleLoadMore = useCallback(() => {
    if (query.data?.nextCursor) {
      setCursor(query.data.nextCursor)
    }
  }, [query.data?.nextCursor])

  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label={t.marketingLoadingRecipientsAria}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 44, borderRadius: 8, background: 'var(--color-gray-100)', marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-error-600)', fontSize: '14px' }}>
        {t.marketingRecipientsLoadFailed}
        <button type="button" onClick={() => query.refetch()} style={{ marginLeft: 8, color: 'var(--color-primary-600)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
          {t.marketingRetry}
        </button>
      </div>
    )
  }

  const recipients = query.data?.data ?? []

  if (recipients.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-gray-500)', fontSize: '14px' }}>
        {t.marketingNoRecipients}
      </div>
    )
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
              <th style={thStyle}>{t.marketingNameCol}</th>
              <th style={thStyle}>{t.marketingPhoneCol}</th>
              <th style={thStyle}>{t.marketingStatusCol}</th>
              <th style={thStyle}>{t.marketingCostCol}</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                <td style={tdStyle}>{r.partyName}</td>
                <td style={tdStyle}>{r.phone ?? '—'}</td>
                <td style={tdStyle}>
                  <DeliveryStatusBadge status={r.status} skipReason={r.skipReason} />
                </td>
                <td style={tdStyle}>{r.costPaise > 0 ? formatPaiseAsRupees(r.costPaise) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data?.nextCursor && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={query.isFetching}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '12px',
            padding: '10px',
            border: '1px solid var(--color-gray-300)',
            borderRadius: '8px',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--color-primary-600)',
          }}
        >
          {query.isFetching ? t.marketingLoadingMore : t.marketingLoadMore}
        </button>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--color-gray-600)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 10px',
  color: 'var(--color-gray-800)',
  verticalAlign: 'middle',
}
