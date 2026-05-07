/** NotificationRow — single notification item in the inbox list */

import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { localiseNotification } from '../notifications.service'
import { useMarkRead } from '../useNotifications'
import type { Notification } from '../notifications.types'
import '../notifications.css'

interface NotificationRowProps {
  notification: Notification
}

/** Format ISO timestamp to human-readable time-ago (max 7 days, then absolute) */
function timeAgo(iso: string, lang: 'en' | 'hi'): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHour = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (lang === 'hi') {
    if (diffMin < 1) return 'अभी'
    if (diffMin < 60) return `${diffMin}मि पहले`
    if (diffHour < 24) return `${diffHour}घं पहले`
    if (diffDay <= 7) return `${diffDay}दिन पहले`
    return new Date(iso).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })
  }

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay <= 7) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function NotificationRow({ notification: n }: NotificationRowProps) {
  const { language } = useLanguage()
  const navigate = useNavigate()
  const markReadMutation = useMarkRead()

  const lang = (language as 'en' | 'hi') ?? 'en'
  const { title, body } = localiseNotification(n, lang)

  function handleClick() {
    if (!n.isRead) {
      markReadMutation.mutate({ id: n.id, titleEn: n.titleEn })
    }
    if (n.deepLinkUrl) {
      // Internal deep links start with /
      if (n.deepLinkUrl.startsWith('/')) {
        navigate(n.deepLinkUrl)
      } else {
        window.location.href = n.deepLinkUrl
      }
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`notif-row${n.isRead ? '' : ' notif-row--unread'}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      aria-label={title}
    >
      <span
        className={`notif-row__dot${n.isRead ? ' notif-row__dot--read' : ''}`}
        aria-hidden="true"
      />
      <div className="notif-row__content">
        <p className="notif-row__title">{title}</p>
        <p className="notif-row__body">{body}</p>
      </div>
      <time
        className="notif-row__time"
        dateTime={n.createdAt}
        aria-label={new Date(n.createdAt).toLocaleString()}
      >
        {timeAgo(n.createdAt, lang)}
      </time>
    </div>
  )
}

/** Skeleton placeholder for a single row */
export function NotificationRowSkeleton() {
  return (
    <div className="notif-skeleton__row" aria-hidden="true">
      <span className="notif-skeleton__dot" />
      <div className="notif-skeleton__lines">
        <div className="notif-skeleton__line notif-skeleton__line--title" />
        <div className="notif-skeleton__line notif-skeleton__line--body" />
      </div>
    </div>
  )
}
