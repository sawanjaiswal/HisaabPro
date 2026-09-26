import { Text } from '@/components/ui/Text'
import type { TransactionLockConfig } from '../settings.types'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'

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
      <Text className="settings-section-title py-0">{t.approvalsTitle}</Text>
      <div className="txn-controls">

        <div className="txn-control-row">
          <div className="txn-control-content">
            <Text className="txn-control-label">{t.requireApprovalEdits}</Text>
            <Text className="txn-control-description">
              {t.approvalEditsDesc}
            </Text>
          </div>
          <label className="settings-toggle" aria-label={t.requireApprovalEditsAria}>
            <Input
              type="checkbox"
              checked={requireApprovalForEdit}
              onChange={(e) => onUpdate('requireApprovalForEdit', e.target.checked)}
            />
            <span className="settings-toggle-track" />
          </label>
        </div>

        <div className="txn-control-row">
          <div className="txn-control-content">
            <Text className="txn-control-label">{t.requireApprovalDeletes}</Text>
            <Text className="txn-control-description">
              {t.approvalDeletesDesc}
            </Text>
          </div>
          <label className="settings-toggle" aria-label={t.requireApprovalDeletesAria}>
            <Input
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
