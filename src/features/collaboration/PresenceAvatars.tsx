// #150 PresenceAvatars — compact "who else is here" cluster for entity headers.
// Editing peers get an amber ring so a user knows before they hit a conflict.
import { useLanguage } from '@/hooks/useLanguage'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { MAX_VISIBLE_AVATARS } from './collaboration.constants'
import type { Peer } from './collaboration.types'
import './collaboration.css'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

interface PresenceAvatarsProps {
  peers: Peer[]
}

export function PresenceAvatars({ peers }: PresenceAvatarsProps) {
  const { t } = useLanguage()
  if (peers.length === 0) return null

  const visible = peers.slice(0, MAX_VISIBLE_AVATARS)
  const overflow = peers.length - visible.length

  return (
    <AvatarGroup
      className="presence-avatars"
      role="group"
      aria-label={t.presenceActiveUsers}
    >
      {visible.map((peer) => (
        <Avatar
          key={peer.userId}
          size="sm"
          data-editing={peer.mode === 'editing' ? 'true' : undefined}
          title={peer.mode === 'editing' ? `${peer.userName} — ${t.presenceEditing}` : peer.userName}
        >
          <AvatarFallback>{initials(peer.userName)}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
    </AvatarGroup>
  )
}
