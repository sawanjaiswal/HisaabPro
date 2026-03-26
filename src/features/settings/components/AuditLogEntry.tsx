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
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { AuditLogEntry as AuditLogEntryType, AuditAction } from '../settings.types'
import { AUDIT_ACTION_LABELS, AUDIT_ACTION_COLORS, AUDIT_ENTITY_LABELS } from '../audit.constants'
import { formatTimeAgo } from '../settings.utils'
import '../audit-log.css'

interface AuditLogEntryProps {
  entry: AuditLogEntryType
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
}

export const AuditLogEntry: React.FC<AuditLogEntryProps> = ({ entry }) => {
  const { t } = useLanguage()
  const Icon = ICON_MAP[entry.action]
  const iconClass = ACTION_ICON_CLASS[entry.action]
  const actionLabel = AUDIT_ACTION_LABELS[entry.action]
  const entityLabel = AUDIT_ENTITY_LABELS[entry.entityType] ?? entry.entityType
  const displayLabel = entry.entityLabel ? `${entityLabel}: ${entry.entityLabel}` : entityLabel

  return (
    <div className="audit-entry">
      <span
        className={`audit-action-icon ${iconClass}`}
        style={{ color: AUDIT_ACTION_COLORS[entry.action] }}
        aria-hidden="true"
      >
        <Icon size={16} />
      </span>

      <div className="audit-entry-body">
        <p className="audit-entry-headline">
          <strong>{entry.userName}</strong> {actionLabel.toLowerCase()} {displayLabel}
        </p>
        <p className="audit-entry-meta">{formatTimeAgo(entry.createdAt)}</p>

        {entry.changes && entry.changes.length > 0 && (
          <div className="audit-changes" role="list" aria-label={t.changesLabel}>
            {entry.changes.map((change) => (
              <div key={change.field} className="audit-change-row" role="listitem">
                <span className="audit-change-field">{change.field}</span>
                <span className="audit-change-before">{change.before}</span>
                <span className="audit-change-arrow" aria-hidden="true">&#8594;</span>
                <span className="audit-change-after">{change.after}</span>
              </div>
            ))}
          </div>
        )}

        {entry.reason && (
          <p className="audit-entry-meta" style={{ marginTop: 'var(--space-2)' }}>
            {t.auditReasonPrefix}: {entry.reason}
          </p>
        )}
      </div>
    </div>
  )
}
