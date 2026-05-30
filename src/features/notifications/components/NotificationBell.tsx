/** NotificationBell — header bell icon with unread badge (0, 1-9, 9+) */

import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useUnreadCount } from '../useNotifications'
import '../notifications.css'
import { Button } from '@/components/ui/Button'

function badgeLabel(count: number): string | null {
  if (count <= 0) return null
  if (count > 9) return '9+'
  return String(count)
}

export function NotificationBell() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { data } = useUnreadCount()

  const unread = data?.unreadCount ?? 0
  const label = badgeLabel(unread)

  return (
    <Button variant="none"
      type="button"
      className="notif-bell"
      onClick={() => navigate(ROUTES.NOTIFICATIONS)}
      aria-label={
        unread > 0
          ? (t.notifBellAriaUnread ?? `Notifications — ${unread} unread`)
          : (t.notifBellAriaEmpty ?? 'Notifications')
      }
      title={t.notifBellTooltip ?? 'Notifications'}
    >
      <Bell size={20} aria-hidden="true" />
      {label !== null && (
        <span className="notif-bell__badge" aria-hidden="true">
          {label}
        </span>
      )}
    </Button>
  )
}
