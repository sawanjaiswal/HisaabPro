/** OptOutListPage — /marketing/opt-outs — opted-out parties management */

import { useState } from 'react'
import { ShieldOff, ShieldCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { MARKETING_ROUTES } from '../marketing.constants'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'

interface OptOutParty {
  id: string
  name: string
  phone: string | null
  marketingOptOut: boolean
  marketingOptOutAt: string | null
}

interface OptOutListResponse {
  optOuts: OptOutParty[]
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

  const parties = query.data?.optOuts ?? []

  return (
    <AppShell>
      <Header
        title={t.marketingOptOutsTitle}
        subtitle={t.marketingOptOutsSubtitle}
        backTo={MARKETING_ROUTES.HUB}
      />
      <PageContainer className="py-4 pb-24 max-w-2xl mx-auto">
        {query.isPending && (
          <div aria-busy="true" aria-label={t.marketingLoadingOptOutsAria} className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}

        {query.isError && (
          <ErrorState
            title={t.marketingOptOutsLoadFailed}
            onRetry={() => { void query.refetch() }}
          />
        )}

        {query.isSuccess && parties.length === 0 && (
          <EmptyState
            icon={<ShieldCheck size={22} aria-hidden="true" />}
            title={t.marketingNoOptOuts}
            description={t.marketingNoOptOutsDesc}
          />
        )}

        {query.isSuccess && parties.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {parties.map((party) => (
              <Card key={party.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card shadow-2xs">
                <ShieldOff size={20} className="text-destructive shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[var(--text-primary)] truncate">{party.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{party.phone ?? t.marketingNoPhoneOnRow}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmOptIn(party)}
                  aria-label={t.marketingAllowMessagesAria.replace('{{name}}', party.name)}
                >
                  {t.marketingAllowMessages}
                </Button>
              </Card>
            ))}
          </div>
        )}

        <ConfirmDialog
          open={Boolean(confirmOptIn)}
          onClose={() => setConfirmOptIn(null)}
          onConfirm={() => {
            if (confirmOptIn) {
              optInMutation.mutate(confirmOptIn)
              setConfirmOptIn(null)
            }
          }}
          title={t.marketingConfirmOptInTitle.replace('{{name}}', confirmOptIn?.name ?? '')}
          description={t.marketingConfirmOptInDesc}
          confirmLabel={t.marketingAllowMessagesBtn}
          cancelLabel={t.marketingCancel}
          isDanger={false}
          isLoading={optInMutation.isPending}
        />
      </PageContainer>
    </AppShell>
  )
}
