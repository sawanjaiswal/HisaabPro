/** Active Sessions — view and revoke login sessions (mockup #97 motif). */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Monitor, Smartphone, Tablet, LogOut } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SettingListRow, SettingListGroup } from '@/components/ui/SettingListRow'
import { ROUTES } from '@/config/routes.config'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import './active-sessions.css'

interface Session {
  id: string
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  deviceName: string
  ipAddress: string
  lastActiveAt: string
  isCurrent: boolean
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

function deviceIcon(type: Session['deviceType']) {
  if (type === 'mobile') return <Smartphone size={18} aria-hidden="true" />
  if (type === 'tablet') return <Tablet size={18} aria-hidden="true" />
  return <Monitor size={18} aria-hidden="true" />
}

function formatLastActive(iso: string, justNow: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return justNow
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ActiveSessionsPage() {
  const toast = useToast()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const query = useQuery<ApiResponse<Session[]>>({
    queryKey: ['sessions'],
    queryFn: () => api<ApiResponse<Session[]>>('/sessions'),
  })

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api(`/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success(t.sessionRevoked)
    },
    onError: () => toast.error(t.sessionRevokeFailed),
  })

  const revokeAllMutation = useMutation({
    mutationFn: () => api('/sessions', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success(t.sessionsRevokedAll)
    },
    onError: () => toast.error(t.sessionsRevokeAllFailed),
  })

  const sessions = query.data?.data ?? []
  const otherSessions = sessions.filter((s) => !s.isCurrent)

  return (
    <AppShell>
      <Header title={t.activeSessionsTitle} backTo={ROUTES.SETTINGS} />

      <HeroPage className="active-sessions-page space-y-6">
        {query.isPending && (
          <SettingListGroup>
            <div className="animate-pulse" aria-busy="true" aria-label={t.activeSessionsTitle}>
              {[1, 2, 3].map((n) => (
                <div key={n} className="session-skeleton" aria-hidden="true" />
              ))}
            </div>
          </SettingListGroup>
        )}

        {query.isError && (
          <ErrorState
            title={t.sessionsCouldNotLoad}
            message={t.checkConnectionRetry}
            onRetry={() => query.refetch()}
          />
        )}

        {query.isSuccess && sessions.length === 0 && (
          <EmptyState icon={<Monitor size={22} aria-hidden="true" />} title={t.noActiveSessions} />
        )}

        {query.isSuccess && sessions.length > 0 && (
          <>
            <SettingListGroup>
              {sessions.map((session) => (
                <SettingListRow
                  key={session.id}
                  icon={deviceIcon(session.deviceType)}
                  label={session.deviceName}
                  description={`${session.ipAddress} · ${formatLastActive(session.lastActiveAt, t.sessionJustNow)}`}
                  badge={session.isCurrent ? <Badge variant="info">{t.sessionThisDevice}</Badge> : undefined}
                  action={
                    session.isCurrent ? undefined : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeMutation.mutate(session.id)}
                        loading={revokeMutation.isPending && revokeMutation.variables === session.id}
                        aria-label={`${t.logout} ${session.deviceName}`}
                      >
                        <LogOut size={16} aria-hidden="true" />
                      </Button>
                    )
                  }
                />
              ))}
            </SettingListGroup>

            {otherSessions.length > 1 && (
              <Button
                variant="destructive"
                size="md"
                loading={revokeAllMutation.isPending}
                onClick={() => revokeAllMutation.mutate()}
                className="btn-block"
              >
                {t.logOutAllOtherDevices}
              </Button>
            )}
          </>
        )}
      </HeroPage>
    </AppShell>
  )
}
