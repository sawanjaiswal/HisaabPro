/** Invoice Form — Confirmation dialog for lines with no tax category set
 *
 * Shown before submitting when gstEnabled and some lines have taxCategoryId = null.
 * User must confirm or go back to fix the missing tax rates.
 */

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface UntaggedTaxDialogProps {
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function UntaggedTaxDialog({ onConfirm, onCancel }: UntaggedTaxDialogProps) {
  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="untagged-dlg-title"
      aria-describedby="untagged-dlg-desc"
    >
      <div className="dialog-card">
        <div className="dialog-icon-wrap">
          <AlertTriangle size={24} className="dialog-icon-warn" aria-hidden="true" />
        </div>
        <h2 id="untagged-dlg-title" className="dialog-title">
          Some items have no tax rate
        </h2>
        <p id="untagged-dlg-desc" className="dialog-desc">
          One or more line items do not have a tax rate assigned. They will be treated as Exempt (0%).
          Continue saving?
        </p>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={onCancel}>
            Go back and fix
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Save anyway
          </Button>
        </div>
      </div>
    </div>
  )
}
