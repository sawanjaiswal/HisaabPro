/** RecipientTable — paginated per-recipient dispatch status */

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/hooks/useLanguage'
import { listCampaignRecipients } from '../marketing.service'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'
import { formatPaiseAsRupees } from '../marketing.utils'
import { Button } from '@/components/ui/Button'

import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'

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
      <div aria-busy="true" aria-label={t.marketingLoadingRecipientsAria} className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="p-4 text-destructive text-sm flex items-center gap-2">
        <span>{t.marketingRecipientsLoadFailed}</span>
        <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
          {t.marketingRetry}
        </Button>
      </div>
    )
  }

  const recipients = query.data?.data ?? []

  if (recipients.length === 0) {
    return (
      <div className="py-6 px-4 text-center text-[var(--text-muted)] text-sm">
        {t.marketingNoRecipients}
      </div>
    )
  }

  return (
    <Card className="overflow-hidden border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[var(--text-muted)]">
              <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">{t.marketingNameCol}</th>
              <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">{t.marketingPhoneCol}</th>
              <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">{t.marketingStatusCol}</th>
              <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">{t.marketingCostCol}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recipients.map((r) => (
              <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3 text-[var(--text-primary)] font-medium">{r.partyName}</td>
                <td className="py-2.5 px-3 text-[var(--text-secondary)]">{r.phone ?? '—'}</td>
                <td className="py-2.5 px-3">
                  <DeliveryStatusBadge status={r.status} skipReason={r.skipReason} />
                </td>
                <td className="py-2.5 px-3 text-[var(--text-secondary)]">{r.costPaise > 0 ? formatPaiseAsRupees(r.costPaise) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data?.nextCursor && (
        <div className="p-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLoadMore}
            disabled={query.isFetching}
          >
            {query.isFetching ? t.marketingLoadingMore : t.marketingLoadMore}
          </Button>
        </div>
      )}
    </Card>
  )
}
