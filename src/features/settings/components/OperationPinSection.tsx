import { Text } from '@/components/ui/Text'
import { Shield } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'

interface OperationPinSectionProps {
  operationPinSet: boolean
}

export function OperationPinSection({ operationPinSet }: OperationPinSectionProps) {
  const { t } = useLanguage()
  return (
    <section>
      <Text className="settings-section-title py-0">{t.operationPinTitle}</Text>
      <div className="txn-controls">
        <div className="txn-control-row">
          <div className="txn-control-content">
            <Text className="txn-control-label">{t.operationPinTitle}</Text>
            <Text className="txn-control-description">
              {t.operationPinDesc}
            </Text>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Shield
              size={16}
              aria-hidden="true"
              className={operationPinSet ? 'text-[var(--color-success-600)]' : 'text-[var(--color-gray-400)]'}
            />
            <span
              className={cn(
                'text-xs font-medium',
                operationPinSet ? 'text-[var(--color-success-600)]' : 'text-[var(--color-gray-400)]'
              )}
            >
              {operationPinSet ? t.operationPinSetLabel : t.operationPinNotSet}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
