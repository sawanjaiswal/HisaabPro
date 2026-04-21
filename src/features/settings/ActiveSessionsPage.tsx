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
              <div
                key={n}
                style={{
                  height: 72,
                  borderRadius: '0.75rem',
                  background: 'var(--color-gray-100)',
                  marginBottom: '0.75rem',
                  opacity: 0.4,
                }}
              />
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
          <div className="stagger-enter" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sessions.map((session) => (
              <div
                key={session.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'var(--color-surface)',
                  border: session.isCurrent
                    ? '1px solid var(--color-primary-200, #bfdbfe)'
                    : '1px solid var(--color-border)',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--color-gray-100)',
                    color: 'var(--color-text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  <DeviceIcon type={session.deviceType} />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                    }}
                  >
                    {session.deviceName}
                    {session.isCurrent && (
                      <span
                        style={{
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 600,
                          padding: '0.125rem 0.375rem',
                          borderRadius: '9999px',
                          background: 'var(--color-primary-100, #dbeafe)',
                          color: 'var(--color-primary-700, #1d4ed8)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        This device
                      </span>
                    )}
                  </p>
                  <p
                    style={{
                      margin: '0.125rem 0 0',
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
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
              <div style={{ marginTop: '0.5rem' }}>
                <Button
                  variant="destructive"
                  size="md"
                  loading={revokeAllMutation.isPending}
                  onClick={() => revokeAllMutation.mutate()}
                  style={{ width: '100%' }}
                >
                  Log Out All Other Devices
                </Button>
              </div>
            )}

            {sessions.length === 0 && (
              <p
                style={{
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--fs-sm)',
                  paddingTop: '2rem',
                }}
              >
                No active sessions found
              </p>
            )}
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
