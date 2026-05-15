/** OptOutListPage — /marketing/opt-outs — opted-out parties management */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldOff, ShieldCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { MARKETING_ROUTES } from '../marketing.constants'

interface OptOutParty {
  id: string
  name: string
  phone: string | null
  marketingOptOut: boolean
  marketingOptOutAt: string | null
}

interface OptOutListResponse {
  data: OptOutParty[]
  nextCursor: string | null
}

function useOptOutList() {
  return useQuery({
    queryKey: ['marketing', 'opt-outs'],
    queryFn: ({ signal }) =>
      api<OptOutListResponse>('/marketing/opt-outs?limit=50', { signal }),
    staleTime: 60_000,
  })
}

export default function OptOutListPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()
  const query = useOptOutList()
  const [confirmOptIn, setConfirmOptIn] = useState<OptOutParty | null>(null)

  const optInMutation = useMutation({
    mutationFn: (party: OptOutParty) =>
      api<{ partyId: string }>(`/marketing/opt-out/${party.id}`, {
        method: 'DELETE',
        entityType: 'marketingOptOut',
        entityLabel: party.name,
      }),
    onSuccess: (_data, party) => {
      toast.success(t.marketingOptOutRestored.replace('{{name}}', party.name))
      void queryClient.invalidateQueries({ queryKey: ['marketing', 'opt-outs'] })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : t.marketingOptOutRestoreFailed
      toast.error(msg)
    },
  })

  const parties = query.data?.data ?? []

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(MARKETING_ROUTES.HUB)} aria-label={t.marketingBackToMarketingAria}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>{t.marketingOptOutsTitle}</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-gray-500)', margin: 0 }}>{t.marketingOptOutsSubtitle}</p>
        </div>
      </div>

      {query.isPending && (
        <div aria-busy="true" aria-label={t.marketingLoadingOptOutsAria}>
          {[0, 1, 2].map((i) => <div key={i} style={{ height: 64, borderRadius: 10, background: 'var(--color-gray-100)', marginBottom: 10, animation: 'pulse 1.5s infinite' }} />)}
        </div>
      )}

      {query.isError && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-error-600)', fontSize: '14px' }}>
          {t.marketingOptOutsLoadFailed}
          <button type="button" onClick={() => query.refetch()} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--color-primary-600)', cursor: 'pointer', fontSize: '14px' }}>
            {t.marketingRetry}
          </button>
        </div>
      )}

      {query.isSuccess && parties.length === 0 && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          <ShieldCheck size={48} color="var(--color-success-400)" style={{ margin: '0 auto 12px', display: 'block' }} aria-hidden="true" />
          <div style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{t.marketingNoOptOuts}</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>{t.marketingNoOptOutsDesc}</div>
        </div>
      )}

      {query.isSuccess && parties.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {parties.map((party) => (
            <div key={party.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '12px', background: 'white', border: '1px solid var(--color-gray-200)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <ShieldOff size={20} color="var(--color-error-400)" aria-hidden="true" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{party.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-gray-400)' }}>{party.phone ?? t.marketingNoPhoneOnRow}</div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOptIn(party)}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--color-gray-300)', background: 'white', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-600)', cursor: 'pointer', flexShrink: 0 }}
                aria-label={t.marketingAllowMessagesAria.replace('{{name}}', party.name)}
              >
                {t.marketingAllowMessages}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm opt-in */}
      {confirmOptIn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="opt-in-title">
          <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: '20px 20px 0 0', padding: '24px 20px' }}>
            <h3 id="opt-in-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: '10px' }}>
              {t.marketingConfirmOptInTitle.replace('{{name}}', confirmOptIn.name)}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--color-gray-600)', marginBottom: '20px' }}>
              {t.marketingConfirmOptInDesc}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setConfirmOptIn(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--color-gray-300)', background: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                {t.marketingCancel}
              </button>
              <button
                type="button"
                onClick={() => { optInMutation.mutate(confirmOptIn); setConfirmOptIn(null) }}
                disabled={optInMutation.isPending}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-primary-600)', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                {t.marketingAllowMessagesBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
