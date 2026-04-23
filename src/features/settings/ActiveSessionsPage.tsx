/** Active Sessions — view and revoke login sessions */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Monitor, Smartphone, Tablet, LogOut } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
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

function DeviceIcon({ type }: { type: Session['deviceType'] }) {
  const size = 18
  if (type === 'mobile') return <Smartphone size={size} aria-hidden="true" />
  if (type === 'tablet') return <Tablet size={size} aria-hidden="true" />
  return <Monitor size={size} aria-hidden="true" />
}

function formatLastActive(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ActiveSessionsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery<ApiResponse<Session[]>>({
    queryKey: ['sessions'],
    queryFn: () => api<ApiResponse<Session[]>>('/sessions'),
  })

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api(`/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Session revoked')
    },
    onError: () => toast.error('Failed to revoke session'),
  })

  const revokeAllMutation = useMutation({
    mutationFn: () => api('/sessions', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('All other sessions logged out')
    },
    onError: () => toast.error('Failed to log out all devices'),
  })

  const sessions = query.data?.data ?? []
  const otherSessions = sessions.filter((s) => !s.isCurrent)

  return (
    <AppShell>
      <Header title="Active Sessions" backTo={ROUTES.SETTINGS} />

      <PageContainer className="space-y-6">
        {query.isPending && (
          <div aria-busy="true" aria-label="Loading sessions">
            {[1, 2, 3].map((n) => (
              <div key={n} className="session-skeleton" />
            ))}
          </div>
        )}

        {query.isError && (
          <ErrorState
            title="Could not load sessions"
            message="Check your connection and try again"
            onRetry={() => query.refetch()}
          />
        )}

        {query.isSuccess && (
          <div className="stagger-enter session-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`session-row${session.isCurrent ? ' session-row--current' : ''}`}
              >
                <span className="session-icon">
                  <DeviceIcon type={session.deviceType} />
                </span>

                <div className="session-meta">
                  <p className="session-name">
                    {session.deviceName}
                    {session.isCurrent && (
                      <span className="session-this-pill">This device</span>
                    )}
                  </p>
                  <p className="session-detail">
                    {session.ipAddress} · {formatLastActive(session.lastActiveAt)}
                  </p>
                </div>

                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeMutation.mutate(session.id)}
                    loading={revokeMutation.isPending && revokeMutation.variables === session.id}
                    aria-label={`Log out ${session.deviceName}`}
                  >
                    <LogOut size={16} aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}

            {otherSessions.length > 1 && (
              <div className="session-revoke-all">
                <Button
                  variant="destructive"
                  size="md"
                  loading={revokeAllMutation.isPending}
                  onClick={() => revokeAllMutation.mutate()}
                  className="btn-block"
                >
                  Log Out All Other Devices
                </Button>
              </div>
            )}

            {sessions.length === 0 && (
              <p className="session-empty">No active sessions found</p>
            )}
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
