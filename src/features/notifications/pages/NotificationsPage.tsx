/** NotificationsPage — Inbox with infinite scroll, 4 UI states, mark-all-read */

import { useEffect, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Bell } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useNotificationInbox, useMarkAllRead } from '../useNotifications'
import { useNotificationStream } from '../useNotificationStream'
import { NotificationRow, NotificationRowSkeleton } from '../components/NotificationRow'
import '../notifications.css'
import { Button } from '@/components/ui/Button'

const SKELETON_COUNT = 8

function InboxSkeleton() {
  return (
    <div className="notif-skeleton" aria-label="Loading notifications" aria-busy="true">
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <NotificationRowSkeleton key={i} />
      ))}
    </div>
  )
}

export default function NotificationsPage() {
  const { t } = useLanguage()
  useNotificationStream()

  const {
    data,
    status,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useNotificationInbox()

  const markAllRead = useMarkAllRead()

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const allNotifications = data?.pages.flatMap((p) => p.data) ?? []
  const unreadCount = data?.pages[0]?.unreadCount ?? 0

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === 'pending') {
    return (
      <AppShell>
        <Header title={t.notifPageTitle ?? 'Notifications'} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <InboxSkeleton />
        </PageContainer>
      </AppShell>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.notifPageTitle ?? 'Notifications'} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <ErrorState
            message={t.notifLoadError ?? 'Could not load notifications. Tap to retry.'}
            onRetry={() => refetch()}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (allNotifications.length === 0) {
    return (
      <AppShell>
        <Header title={t.notifPageTitle ?? 'Notifications'} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <EmptyState
            icon={<Bell size={22} aria-hidden="true" />}
            title={t.notifEmptyTitle ?? "You're all caught up!"}
            description={t.notifEmptyBody ?? 'No notifications yet. We\'ll let you know when something happens.'}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <Header title={t.notifPageTitle ?? 'Notifications'} backTo={ROUTES.DASHBOARD} />
      <PageContainer>
        <div className="notif-inbox__header">
          <span className="notif-inbox__unread-label">
            {unreadCount > 0
              ? (t.notifUnreadCount ?? `${unreadCount} unread`).replace('%d', String(unreadCount))
              : (t.notifAllRead ?? 'All caught up')}
          </span>
          {unreadCount > 0 && (
            <Button variant="none"
              type="button"
              className="notif-inbox__mark-all-btn"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              {t.notifMarkAllRead ?? 'Mark all read'}
            </Button>
          )}
        </div>

        {allNotifications.map((n) => (
          <NotificationRow key={n.id} notification={n} />
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} aria-hidden="true" />

        {isFetchingNextPage && (
          <div className="notif-inbox__load-more" aria-busy="true">
            <InboxSkeleton />
          </div>
        )}

        {hasNextPage && !isFetchingNextPage && (
          <div className="notif-inbox__load-more">
            <Button variant="none"
              type="button"
              className="notif-inbox__load-more-btn"
              onClick={() => fetchNextPage()}
            >
              {t.notifLoadMore ?? 'Load more'}
            </Button>
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
