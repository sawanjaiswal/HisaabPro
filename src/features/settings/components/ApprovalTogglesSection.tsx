import { Text } from '@/components/ui/Text'
import type { TransactionLockConfig } from '../settings.types'
import { useLanguage } from '@/hooks/useLanguage'
import { Switch } from '@/components/ui/Switch'

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
          <Switch
            checked={requireApprovalForEdit}
            onCheckedChange={(checked) => onUpdate('requireApprovalForEdit', checked)}
            ariaLabel={t.requireApprovalEditsAria}
          />
        </div>

        <div className="txn-control-row">
          <div className="txn-control-content">
            <Text className="txn-control-label">{t.requireApprovalDeletes}</Text>
            <Text className="txn-control-description">
              {t.approvalDeletesDesc}
            </Text>
          </div>
          <Switch
            checked={requireApprovalForDelete}
            onCheckedChange={(checked) => onUpdate('requireApprovalForDelete', checked)}
            ariaLabel={t.requireApprovalDeletesAria}
          />
        </div>

      </div>
    </section>
  )
}
