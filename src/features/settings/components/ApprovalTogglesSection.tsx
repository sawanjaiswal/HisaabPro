import type { TransactionLockConfig } from '../settings.types'

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
  return (
    <section>
      <p className="settings-section-title">Approvals</p>
      <div className="txn-controls">

        <div className="txn-control-row">
          <div className="txn-control-content">
            <p className="txn-control-label">Require Approval for Edits</p>
            <p className="txn-control-description">
              Staff must request approval before editing locked transactions
            </p>
          </div>
          <label className="settings-toggle" aria-label="Require approval for edits">
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
            <p className="txn-control-label">Require Approval for Deletes</p>
            <p className="txn-control-description">
              Staff must request approval before deleting any transaction
            </p>
          </div>
          <label className="settings-toggle" aria-label="Require approval for deletes">
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
