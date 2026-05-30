/** Audit Filter Drawer — Phase 6 PR4 FE
 *
 * Drawer-wrapped filter form for /settings/audit. Mirrors the BE query
 * surface: q, action, entityType, userId, dateFrom, dateTo. Date fields
 * use native `<Input type="date">` (ISO yyyy-mm-dd, what the BE accepts).
 *
 * State is held locally until the user taps "Apply", then applied to the
 * parent hook in one shot — prevents partial filter changes from kicking
 * off intermediate requests.
 */

import { useEffect, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectItem } from '@/components/ui/Select'

const ALL = '__all__' as const
import { useLanguage } from '@/hooks/useLanguage'
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from '../audit.constants'
import type { AuditAction, AuditSearchFilters } from '../audit.types'

interface AuditFilterDrawerProps {
  open: boolean
  onClose: () => void
  initial: AuditSearchFilters
  onApply: (filters: AuditSearchFilters) => void
  onClear: () => void
}

const ACTION_OPTIONS: Array<{ value: AuditAction | ''; label: string }> = [
  { value: '', label: '' /* filled at render via t.auditAllActions */ },
  ...(Object.entries(AUDIT_ACTION_LABELS) as Array<[AuditAction, string]>).map(
    ([value, label]) => ({ value, label }),
  ),
]

const ENTITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '' /* filled at render via t.auditAllEntities */ },
  ...Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => ({ value, label })),
]

export function AuditFilterDrawer({
  open,
  onClose,
  initial,
  onApply,
  onClear,
}: AuditFilterDrawerProps) {
  const { t } = useLanguage()
  const [draft, setDraft] = useState<AuditSearchFilters>(initial)

  // Reset draft to the parent's current filters every time the drawer opens —
  // so a user who cancels mid-edit doesn't carry stale state into next open.
  useEffect(() => {
    if (open) setDraft(initial)
  }, [open, initial])

  const update = <K extends keyof AuditSearchFilters>(key: K, value: AuditSearchFilters[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleApply = () => {
    // Normalize empty strings → undefined so the service layer omits them
    const cleaned: AuditSearchFilters = {
      q:          draft.q || undefined,
      entityType: draft.entityType || undefined,
      action:     draft.action || undefined,
      userId:     draft.userId || undefined,
      dateFrom:   draft.dateFrom || undefined,
      dateTo:     draft.dateTo || undefined,
    }
    onApply(cleaned)
    onClose()
  }

  const handleClear = () => {
    setDraft({})
    onClear()
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.auditFiltersLabel}
      size="md"
      footer={(
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="md" onClick={handleClear} style={{ flex: 1 }}>
            {t.auditClearFilters}
          </Button>
          <Button variant="primary" size="md" onClick={handleApply} style={{ flex: 1 }}>
            {t.auditApplyFilters}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <Input
          label={t.auditSearchPlaceholder}
          value={draft.q ?? ''}
          onChange={(e) => update('q', e.target.value)}
          placeholder={t.auditSearchPlaceholder}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        <div className="input-group">
          <label htmlFor="audit-filter-action" className="input-label">
            {t.auditActionLabel}
          </label>
          <Select
            value={draft.action ?? ALL}
            onValueChange={(v) => update('action', (v === ALL ? undefined : v) as AuditAction | undefined)}
            ariaLabel={t.auditActionLabel}
          >
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || 'all'} value={opt.value === '' ? ALL : opt.value}>
                {opt.value === '' ? t.auditAllActions : opt.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="input-group">
          <label htmlFor="audit-filter-entity" className="input-label">
            {t.auditEntityLabel}
          </label>
          <Select
            value={draft.entityType ?? ALL}
            onValueChange={(v) => update('entityType', v === ALL ? undefined : v)}
            ariaLabel={t.auditEntityLabel}
          >
            {ENTITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || 'all'} value={opt.value === '' ? ALL : opt.value}>
                {opt.value === '' ? t.auditAllEntities : opt.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        <Input
          label={t.auditActorLabel}
          value={draft.userId ?? ''}
          onChange={(e) => update('userId', e.target.value)}
          placeholder={t.auditActorLabel}
          autoComplete="off"
        />

        <Input
          label={t.auditDateFromLabel}
          type="date"
          value={draft.dateFrom ?? ''}
          onChange={(e) => update('dateFrom', e.target.value)}
        />

        <Input
          label={t.auditDateToLabel}
          type="date"
          value={draft.dateTo ?? ''}
          onChange={(e) => update('dateTo', e.target.value)}
        />
      </div>
    </Drawer>
  )
}
