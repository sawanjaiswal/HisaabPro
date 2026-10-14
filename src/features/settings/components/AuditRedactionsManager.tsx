/** Audit Redactions Manager — Phase 6 PR4 FE
 *
 * Drawer-hosted UI to list, add, and disable per-business audit redactions.
 *
 * Add form lives at the top; existing rules render as a list with a
 * "Disable" affordance per row (confirm dialog → soft-disable on server).
 */

import { Text } from '@/components/ui/Text'
import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select, SelectItem } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { AUDIT_ENTITY_LABELS } from '../audit.constants'
import { useAuditRedactions } from '../useAuditRedactions'
import type { Redaction } from '../audit.types'

interface AuditRedactionsManagerProps {
  open: boolean
  onClose: () => void
}

const ENTITY_OPTIONS = Object.entries(AUDIT_ENTITY_LABELS)

export function AuditRedactionsManager({ open, onClose }: AuditRedactionsManagerProps) {
  const { t } = useLanguage()
  const { items, status, addOrUpdate, disable, isSaving, refresh } = useAuditRedactions()

  const [entityType, setEntityType] = useState<string>(ENTITY_OPTIONS[0]?.[0] ?? '')
  const [fieldPath, setFieldPath] = useState<string>('')
  const [confirmTarget, setConfirmTarget] = useState<Redaction | null>(null)

  const handleAdd = async () => {
    if (!entityType.trim() || !fieldPath.trim()) return
    await addOrUpdate({ entityType: entityType.trim(), fieldPath: fieldPath.trim(), enabled: true })
    setFieldPath('')
  }

  const handleDisableConfirmed = async () => {
    if (!confirmTarget) return
    const target = confirmTarget
    setConfirmTarget(null)
    await disable(target.id, `${target.entityType}.${target.fieldPath}`)
  }

  const activeItems = items.filter((r) => r.enabled)

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={t.auditRedactionsTitle}
        size="md"
      >
        {/* Add form */}
        <section className="space-y-4">
          <div className="input-group">
            <label htmlFor="redaction-entity" className="input-label">
              {t.auditRedactionsEntityType}
            </label>
            <Select
              value={entityType}
              onValueChange={setEntityType}
              ariaLabel={t.auditRedactionsEntityType}
            >
              {ENTITY_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </Select>
          </div>

          <Input
            label={t.auditRedactionsFieldPath}
            value={fieldPath}
            onChange={(e) => setFieldPath(e.target.value)}
            placeholder="e.g. phone or address.city"
            autoComplete="off"
          />

          <Button
            variant="primary"
            size="md"
            onClick={handleAdd}
            disabled={!entityType.trim() || !fieldPath.trim() || isSaving}
            loading={isSaving}
          >
            <Plus size={16} aria-hidden="true" className="mr-2" />
            {t.auditRedactionsAddCta}
          </Button>
        </section>

        {/* List */}
        <section className="mt-6">
          {status === 'loading' && (
            <div aria-busy="true" aria-label={t.auditRedactionsTitle} className="space-y-2">
              {[1, 2, 3].map((n) => (
                <Skeleton
                  key={n}
                  height="3.5rem"
                  borderRadius="var(--radius-md)"
                />
              ))}
            </div>
          )}

          {status === 'error' && (
            <ErrorState title={t.auditLoadError} onRetry={refresh} />
          )}

          {status === 'success' && activeItems.length === 0 && (
            <EmptyState title={t.auditRedactionsEmpty} />
          )}

          {status === 'success' && activeItems.length > 0 && (
            <ul className="list-none p-0 m-0 space-y-2">
              {activeItems.map((r) => (
                <li key={r.id}>
                  <Card className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Text className="m-0 font-medium text-[var(--color-gray-900)]">
                        {AUDIT_ENTITY_LABELS[r.entityType] ?? r.entityType}
                      </Text>
                      <Text className="m-0 text-xs text-[var(--color-gray-500)] break-all">
                        {r.fieldPath}
                      </Text>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => setConfirmTarget(r)}
                      aria-label={t.auditRedactionsDisableCta}
                      className="text-destructive shrink-0"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Drawer>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={t.auditRedactionsDisableCta}
        description={t.auditRedactionsConfirmDisable}
        confirmLabel={t.auditRedactionsDisableCta}
        cancelLabel={t.cancel}
        isDanger
        onConfirm={handleDisableConfirmed}
        onClose={() => setConfirmTarget(null)}
      />
    </>
  )
}
