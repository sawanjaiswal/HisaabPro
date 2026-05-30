/** Audit Export Button — Phase 6 PR4 FE
 *
 * Posts the active filter set to `/audit/export`, receives a `text/csv` blob,
 * and triggers a browser download. The icon-only Header variant collapses
 * gracefully on narrow viewports; a labelled inline variant is also exported
 * for use inside the redactions sub-page.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Download } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { exportAuditLog, downloadAuditCsv } from '../audit-log.service'
import type { AuditSearchFilters } from '../audit.types'

interface AuditExportButtonProps {
  filters: AuditSearchFilters
  /** 'icon' → 44x44 header-action button; 'inline' → labelled button.
   *  Default 'icon'. */
  variant?: 'icon' | 'inline'
}

function buildFileName(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  return `audit-log-${stamp}.csv`
}

export function AuditExportButton({
  filters,
  variant = 'icon',
}: AuditExportButtonProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      const blob = await exportAuditLog(filters)
      downloadAuditCsv(blob, buildFileName())
      toast.success(t.auditExportSuccess)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.auditExportFailed
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'icon') {
    return (
      <Button variant="none"
        type="button"
        className="staff-action-button"
        onClick={handleClick}
        disabled={busy}
        aria-label={t.auditExportCsv}
        aria-busy={busy}
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Download size={20} aria-hidden="true" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="secondary" size="md"
      onClick={handleClick}
      disabled={busy}
      aria-busy={busy}
    >
      <Download size={16} aria-hidden="true" style={{ marginRight: 'var(--space-2)' }} />
      {t.auditExportCsv}
    </Button>
  )
}
