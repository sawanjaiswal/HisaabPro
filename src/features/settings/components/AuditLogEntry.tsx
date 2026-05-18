import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import {
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  LockOpen,
  KeyRound,
  UserCog,
  ClipboardCheck,
  MessageSquare,
  Pause,
  Play,
  CheckCircle2,
  Undo2,
  ChevronRight,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { AuditSearchRow, AuditAction } from '../settings.types'
import { AUDIT_ACTION_LABELS, AUDIT_ACTION_COLORS, AUDIT_ENTITY_LABELS } from '../audit.constants'
import { formatTimeAgo } from '../settings.utils'
import '../audit-log.css'

interface AuditLogEntryProps {
  entry: AuditSearchRow
  /** Click handler — opens the per-row diff drawer */
  onSelect?: (entry: AuditSearchRow) => void
}

type IconComponent = React.FC<LucideProps>

const ICON_MAP: Record<AuditAction, IconComponent> = {
  CREATE:            Plus,
  UPDATE:            Pencil,
  DELETE:            Trash2,
  RESTORE:           RotateCcw,
  LOCK_OVERRIDE:     LockOpen,
  PIN_RESET:         KeyRound,
  ROLE_CHANGE:       UserCog,
  APPROVAL_REQUEST:  ClipboardCheck,
  APPROVAL_RESPONSE: MessageSquare,
  SUSPEND_FIRM:      Pause,
  REACTIVATE_FIRM:   Play,
  FINALIZE:          CheckCircle2,
  REVERSE:           Undo2,
}

const ACTION_ICON_CLASS: Record<AuditAction, string> = {
  CREATE:            'audit-action-icon--create',
  UPDATE:            'audit-action-icon--update',
  DELETE:            'audit-action-icon--delete',
  RESTORE:           'audit-action-icon--restore',
  LOCK_OVERRIDE:     'audit-action-icon--pin',
  PIN_RESET:         'audit-action-icon--pin',
  ROLE_CHANGE:       'audit-action-icon--role-change',
  APPROVAL_REQUEST:  'audit-action-icon--update',
  APPROVAL_RESPONSE: 'audit-action-icon--update',
  SUSPEND_FIRM:      'audit-action-icon--pin',
  REACTIVATE_FIRM:   'audit-action-icon--restore',
  FINALIZE:          'audit-action-icon--update',
  REVERSE:           'audit-action-icon--delete',
}

/** Headline actor — prefer userName (real user) over systemActor (cron/system) */
function actorLabel(entry: AuditSearchRow, fallback: string): string {
  if (entry.userName) return entry.userName
  if (entry.systemActor) return entry.systemActor
  return fallback
}

export const AuditLogEntry: React.FC<AuditLogEntryProps> = ({ entry, onSelect }) => {
  const { t } = useLanguage()
  const Icon = ICON_MAP[entry.action] ?? Pencil
  const iconClass = ACTION_ICON_CLASS[entry.action] ?? 'audit-action-icon--update'
  const actionLabel = AUDIT_ACTION_LABELS[entry.action] ?? entry.action
  const entityLabel = AUDIT_ENTITY_LABELS[entry.entityType] ?? entry.entityType
  const displayLabel = entry.entityLabel ? `${entityLabel}: ${entry.entityLabel}` : entityLabel
  const actor = actorLabel(entry, t.auditActorSystem)

  // If the parent supplied an onSelect, render as a clickable row that opens
  // the diff drawer. Otherwise render as a plain article (no affordance).
  const interactive = typeof onSelect === 'function'
  const RowTag: 'button' | 'div' = interactive ? 'button' : 'div'

  return (
    <RowTag
      type={interactive ? 'button' : undefined}
      className={`audit-entry${interactive ? ' audit-entry--interactive' : ''}`}
      onClick={interactive ? () => onSelect?.(entry) : undefined}
      aria-label={interactive ? `${actor} ${actionLabel.toLowerCase()} ${displayLabel}` : undefined}
      style={{ minHeight: interactive ? 44 : undefined }}
    >
      <span
        className={`audit-action-icon ${iconClass}`}
        style={{ color: AUDIT_ACTION_COLORS[entry.action] }}
        aria-hidden="true"
      >
        <Icon size={16} />
      </span>

      <div className="audit-entry-body">
        <p className="audit-entry-headline">
          <strong>{actor}</strong> {actionLabel.toLowerCase()} {displayLabel}
        </p>
        <p className="audit-entry-meta">{formatTimeAgo(entry.createdAt)}</p>

        {entry.reason && (
          <p className="audit-entry-meta" style={{ marginTop: 'var(--space-2)' }}>
            {t.auditReasonPrefix}: {entry.reason}
          </p>
        )}
      </div>

      {interactive && (
        <ChevronRight
          size={18}
          aria-hidden="true"
          style={{ color: 'var(--color-gray-400)', flexShrink: 0 }}
        />
      )}
    </RowTag>
  )
}
