import type { TransactionLockConfig } from '../settings.types'
import { useLanguage } from '@/hooks/useLanguage'

interface ApprovalTogglesSectionProps {
  requireApprovalForEdit: boolean
  requireApprovalForDelete: boolean
  onUpdate: <K extends keyof TransactionLockConfig>(key: K, value: TransactionLockConfig[K]) => void
}

export function ApprovalTogglesSection({
  requireApprovalForEdit,
  requireApprovalForDelete,
  onUpdate,
}: ApprovalTogglesSectionProps) {
  const { t } = useLanguage()

  return (
    <section>
      <p className="settings-section-title py-0">{t.approvalsTitle}</p>
      <div className="txn-controls">

        <div className="txn-control-row">
          <div className="txn-control-content">
            <p className="txn-control-label">{t.requireApprovalEdits}</p>
            <p className="txn-control-description">
              {t.approvalEditsDesc}
            </p>
          </div>
          <label className="settings-toggle" aria-label={t.requireApprovalEditsAria}>
            <input
              type="checkbox"
              checked={requireApprovalForEdit}
              onChange={(e) => onUpdate('requireApprovalForEdit', e.target.checked)}
            />
            <span className="settings-toggle-track" />
          </label>
        </div>

        <div className="txn-control-row">
          <div className="txn-control-content">
            <p className="txn-control-label">{t.requireApprovalDeletes}</p>
            <p className="txn-control-description">
              {t.approvalDeletesDesc}
            </p>
          </div>
          <label className="settings-toggle" aria-label={t.requireApprovalDeletesAria}>
            <input
              type="checkbox"
              checked={requireApprovalForDelete}
              onChange={(e) => onUpdate('requireApprovalForDelete', e.target.checked)}
            />
            <span className="settings-toggle-track" />
          </label>
        </div>

      </div>
    </section>
  )
}
