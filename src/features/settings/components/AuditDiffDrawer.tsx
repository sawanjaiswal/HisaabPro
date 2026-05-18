/** Audit Diff Drawer — Phase 6 PR4 FE
 *
 * Renders the `changes` field of a single AuditSearchRow. The server may
 * shape `changes` three different ways depending on the audit producer:
 *
 *   1. `{ before: <object|primitive>, after: <object|primitive> }` envelope
 *      — most CRUD writers ship this.
 *   2. Flat patch object (no `before`/`after` wrapper) — older audit
 *      producers and some FINALIZE/REVERSE writers ship this.
 *   3. Primitive value (string|number|boolean|null) — single-field updates.
 *
 * Anywhere a value is exactly the redaction sentinel `{ __redacted: true }`,
 * we substitute the locale-aware `<redacted>` placeholder.
 *
 * Rendered as pre-formatted JSON inside a <pre> with tabular-nums so the
 * before/after columns line up.
 */

import { useMemo } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from '../audit.constants'
import type { AuditChangesPayload, AuditSearchRow } from '../audit.types'

interface AuditDiffDrawerProps {
  open: boolean
  onClose: () => void
  entry: AuditSearchRow | null
}

/** Returns true when `value` is exactly the redaction sentinel. */
function isRedacted(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, '__redacted')
    && (value as { __redacted: unknown }).__redacted === true
    && Object.keys(value as object).length === 1
}

/** Replace every nested redaction sentinel with the locale placeholder.
 *  Pure — does not mutate the input. */
function applyRedactionPlaceholders(value: unknown, placeholder: string): unknown {
  if (isRedacted(value)) return placeholder
  if (Array.isArray(value)) return value.map((v) => applyRedactionPlaceholders(v, placeholder))
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = applyRedactionPlaceholders(v, placeholder)
    }
    return out
  }
  return value
}

/** Detect the {before, after} envelope shape. Both keys must be present, no
 *  extra keys, and the object is plain (not array/null). */
function isBeforeAfterEnvelope(
  payload: AuditChangesPayload,
): payload is { before: unknown; after: unknown } {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return false
  const keys = Object.keys(payload as Record<string, unknown>)
  return keys.length === 2 && keys.includes('before') && keys.includes('after')
}

/** Format any value as pretty-printed JSON. Primitives stringify natively. */
function formatJson(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function AuditDiffDrawer({ open, onClose, entry }: AuditDiffDrawerProps) {
  const { t } = useLanguage()

  const titleText = useMemo(() => {
    if (!entry) return t.auditDiffTitle
    const action = AUDIT_ACTION_LABELS[entry.action] ?? entry.action
    const entityLabel = AUDIT_ENTITY_LABELS[entry.entityType] ?? entry.entityType
    return `${action} · ${entityLabel}${entry.entityLabel ? `: ${entry.entityLabel}` : ''}`
  }, [entry, t.auditDiffTitle])

  // Compute the two sides — applies redactions once, memoized on entry/locale
  const sides = useMemo(() => {
    if (!entry) return null
    const placeholder = t.auditDiffRedactedPlaceholder
    const safe = applyRedactionPlaceholders(entry.changes, placeholder)
    if (safe === null || safe === undefined) return { before: null, after: null, empty: true }
    if (isBeforeAfterEnvelope(safe as AuditChangesPayload)) {
      const envelope = safe as { before: unknown; after: unknown }
      return { before: envelope.before, after: envelope.after, empty: false }
    }
    return { before: null, after: safe, empty: false }
  }, [entry, t.auditDiffRedactedPlaceholder])

  return (
    <Drawer open={open} onClose={onClose} title={titleText} size="lg">
      {!entry || !sides || sides.empty ? (
        <p className="audit-entry-meta" role="status">{t.auditDiffNoChanges}</p>
      ) : (
        <div className="space-y-4">
          {sides.before !== null && (
            <section>
              <p className="settings-section-title py-0">{t.auditDiffBefore}</p>
              <pre
                className="audit-diff-pre"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-gray-50)',
                  border: '1px solid var(--color-gray-200)',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--color-gray-900)',
                  marginTop: 'var(--space-2)',
                  overflowX: 'auto',
                }}
                aria-label={t.auditDiffBefore}
              >
                {formatJson(sides.before)}
              </pre>
            </section>
          )}

          <section>
            <p className="settings-section-title py-0">{t.auditDiffAfter}</p>
            <pre
              className="audit-diff-pre"
              style={{
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-gray-50)',
                border: '1px solid var(--color-gray-200)',
                fontSize: 'var(--fs-xs)',
                color: 'var(--color-gray-900)',
                marginTop: 'var(--space-2)',
                overflowX: 'auto',
              }}
              aria-label={t.auditDiffAfter}
            >
              {formatJson(sides.after)}
            </pre>
          </section>
        </div>
      )}
    </Drawer>
  )
}
